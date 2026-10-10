#!/usr/bin/env node
// Runtime measurements with Playwright + CDP (no throttling, real timings):
//   1. cold page loads (new context per load, logged in through storage state):
//      request inventory & waterfall, data-visible time, hydration, long tasks,
//      CDP script time, JS heap, DOM size, React commit count;
//   2. a client-side navigation flow through the sidebar (RSC fetches, API
//      calls, TanStack cache hits on revisits, /api/auth/session calls).
//
//   node perf/frontend/runtime.mjs --out <dir> --runs 3 \
//     --version branch=http://127.0.0.1:13461,<dir>/auth-branch.json,http://127.0.0.1:18461 \
//     --version main=http://127.0.0.1:13462,<dir>/auth-main.json,http://127.0.0.1:18462 \
//     --account-branch <id> --account-main <id> [--react] [--tag name] [--pages a,b] [--no-flow]
//
// --react walks the fiber tree on every commit to count component renders (adds
// overhead: use it in a separate run, ideally against a `next build --profile` build).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { CHROME_PATH, chromium, median, pages, parseArgs, writeCsv } from './lib/common.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const INPAGE = fs.readFileSync(path.join(here, 'lib/inpage.js'), 'utf8')
const args = parseArgs()
const tag = args.tag || 'runtime'
const out = path.join(args.out || './perf-results', tag)
fs.mkdirSync(out, { recursive: true })
const runs = Number(args.runs || 3)
const vlist = []
for (let i = 0; i < process.argv.length; i++) if (process.argv[i] === '--version') vlist.push(process.argv[i + 1])
const versions = vlist.map((s) => {
  const [label, rest] = s.split('=')
  const [base, storage, backend] = rest.split(',')
  return { label, base, storage, backend, account: args[`account-${label}`] }
})
const only = args.pages ? new Set(args.pages.split(',')) : null
const countRenders = !!args.react

function classify(url, method, resourceType, backend, headers = {}) {
  const u = new URL(url)
  const p = u.pathname
  if (method === 'OPTIONS') return 'preflight'
  if (p.startsWith('/api/backend/notifications') && !p.includes('history') && !p.includes('read')) return 'sse'
  if (backend && url.startsWith(backend)) {
    if (p === '/notifications') return 'sse'
    return 'direct'
  }
  if (p.startsWith('/api/backend/')) return 'proxy'
  if (p === '/api/auth/session') return 'session'
  if (p === '/api/auth/csrf') return 'csrf'
  if (p.startsWith('/api/auth/')) return 'auth'
  if (u.searchParams.has('_rsc') || headers.rsc === '1') return 'rsc'
  if (resourceType === 'document') return 'document'
  if (p.startsWith('/_vercel')) return 'vercel'
  if (resourceType === 'script') return 'js'
  if (resourceType === 'stylesheet') return 'css'
  if (resourceType === 'font') return 'font'
  if (resourceType === 'image') return 'image'
  return resourceType || 'other'
}
const DATA = new Set(['proxy', 'direct', 'session', 'rsc', 'csrf', 'auth'])
const keyOf = (r) => {
  const u = new URL(r.url)
  u.searchParams.delete('_rsc')
  return `${r.method} ${u.pathname}${u.search}`
}

/** Records requests of a page via Playwright events + CDP (for preflights). */
async function recorder(page, cdp, backend) {
  const reqs = []
  const byReq = new Map()
  page.on('request', (req) => {
    const r = {
      url: req.url(),
      method: req.method(),
      type: req.resourceType(),
      cls: classify(req.url(), req.method(), req.resourceType(), backend, req.headers()),
      wall: Date.now(),
      start: null,
      end: null,
      status: null,
      bytes: null,
      failed: false,
    }
    reqs.push(r)
    byReq.set(req, r)
  })
  const finish = async (req, failed) => {
    const r = byReq.get(req)
    if (!r) return
    try {
      const t = req.timing()
      r.start = t.startTime
      r.end = t.responseEnd >= 0 ? t.startTime + t.responseEnd : null
    } catch {}
    r.failed = failed
    try {
      const resp = await req.response()
      r.status = resp?.status() ?? null
      const sizes = await req.sizes()
      r.bytes = sizes.responseBodySize + sizes.responseHeadersSize
    } catch {}
  }
  page.on('requestfinished', (req) => void finish(req, false))
  page.on('requestfailed', (req) => void finish(req, true))
  // CORS preflights are invisible to Playwright's request events.
  const preflights = []
  await cdp.send('Network.enable')
  cdp.on('Network.requestWillBeSent', (e) => {
    if (e.type === 'Preflight' || e.request.method === 'OPTIONS') preflights.push({ url: e.request.url, wall: Date.now() })
  })
  return { reqs, preflights }
}

async function waitQuiet(rec, page, { quietMs = 1500, maxMs = 20000 } = {}) {
  const t0 = Date.now()
  let lastCount = -1
  let lastChange = Date.now()
  while (Date.now() - t0 < maxMs) {
    const pending = rec.reqs.filter((r) => r.cls !== 'sse' && r.end === null && !r.failed && Date.now() - r.wall < 15000).length
    const count = rec.reqs.length
    if (count !== lastCount || pending > 0) {
      lastCount = count
      lastChange = Date.now()
    }
    if (Date.now() - lastChange >= quietMs) return
    await page.waitForTimeout(100)
  }
}

function waves(dataReqs) {
  const sorted = dataReqs.filter((r) => r.start !== null && r.end !== null).sort((a, b) => a.start - b.start)
  let max = 0
  for (const r of sorted) {
    let w = 1
    for (const q of sorted) if (q !== r && q.end <= r.start + 1 && q.wave) w = Math.max(w, q.wave + 1)
    r.wave = w
    max = Math.max(max, w)
  }
  return max
}

function summarizeRequests(reqs, origin) {
  const counts = {}
  const bytes = {}
  for (const r of reqs) {
    counts[r.cls] = (counts[r.cls] || 0) + 1
    bytes[r.cls] = (bytes[r.cls] || 0) + (r.bytes || 0)
  }
  const data = reqs.filter((r) => DATA.has(r.cls))
  const dupMap = {}
  for (const r of reqs.filter((x) => ['proxy', 'direct', 'session', 'rsc', 'csrf'].includes(x.cls))) dupMap[keyOf(r)] = (dupMap[keyOf(r)] || 0) + 1
  const dups = Object.entries(dupMap).filter(([, n]) => n > 1)
  const lastDataEnd = Math.max(0, ...data.filter((r) => r.end).map((r) => r.end - origin))
  return {
    counts,
    bytes,
    dups,
    waves: waves(data.filter((r) => r.cls !== 'rsc')),
    lastDataEnd,
    waterfall: data
      .filter((r) => r.start)
      .sort((a, b) => a.start - b.start)
      .map((r) => ({
        cls: r.cls,
        method: r.method,
        path: new URL(r.url).pathname + new URL(r.url).search.replace(/_rsc=[^&]*/, '_rsc'),
        start: Math.round(r.start - origin),
        end: r.end ? Math.round(r.end - origin) : null,
        ms: r.end ? Math.round(r.end - r.start) : null,
        status: r.status,
        bytes: r.bytes,
        wave: r.wave,
      })),
  }
}

async function metrics(cdp) {
  const { metrics } = await cdp.send('Performance.getMetrics')
  return Object.fromEntries(metrics.map((m) => [m.name, m.value]))
}

async function coldLoad(browser, v, pg, run) {
  const context = await browser.newContext(pg.auth ? { storageState: v.storage } : {})
  const marker = pg.marker.text ? { text: pg.marker.text.source } : { selector: pg.marker.selector }
  await context.addInitScript(`window.__perfConfig=${JSON.stringify({ marker, countRenders })};\n${INPAGE}`)
  const page = await context.newPage()
  const cdp = await context.newCDPSession(page)
  await cdp.send('Performance.enable', { timeDomain: 'timeTicks' })
  const rec = await recorder(page, cdp, v.backend)
  const url = v.base + pg.path.replace('ACCOUNT', v.account)
  const wall0 = Date.now()
  let error = ''
  try {
    await page.goto(url, { waitUntil: 'load', timeout: 60000 })
    await page.waitForFunction(() => window.__perf && window.__perf.markerAt !== null, null, { timeout: 20000 }).catch(() => {
      error = 'marker-timeout'
    })
    await waitQuiet(rec, page)
  } catch (e) {
    error = String(e).slice(0, 120)
  }
  const origin = await page.evaluate(() => performance.timeOrigin)
  const p = await page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0]
    const q = window.__perf
    return {
      ttfb: nav?.responseStart,
      dcl: nav?.domContentLoadedEventEnd,
      load: nav?.loadEventEnd,
      docBytes: nav?.transferSize,
      docDecoded: nav?.decodedBodySize,
      fcp: q.fcp,
      lcp: q.lcp,
      cls: q.cls,
      markerAt: q.markerAt,
      hydratedAt: q.hydratedAt,
      commits: q.commits.length,
      rendered: q.commits.reduce((s, c) => s + c.rendered, 0),
      renders: q.renders,
      longTasks: q.longTasks,
      domNodes: document.getElementsByTagName('*').length,
      finalPath: location.pathname,
    }
  })
  const m1 = await metrics(cdp)
  await cdp.send('HeapProfiler.enable')
  await cdp.send('HeapProfiler.collectGarbage')
  const m2 = await metrics(cdp)
  const s = summarizeRequests(rec.reqs, origin)
  const lt = p.longTasks
  const row = {
    version: v.label,
    page: pg.name,
    run,
    finalPath: p.finalPath,
    error,
    ttfb: Math.round(p.ttfb),
    fcp: Math.round(p.fcp),
    lcp: Math.round(p.lcp),
    cls: Number((p.cls || 0).toFixed(3)),
    dcl: Math.round(p.dcl),
    load: Math.round(p.load),
    hydrated: p.hydratedAt ? Math.round(p.hydratedAt) : '',
    dataVisible: p.markerAt ? Math.round(p.markerAt) : '',
    lastDataEnd: Math.round(s.lastDataEnd),
    requests: rec.reqs.length,
    js: s.counts.js || 0,
    rsc: s.counts.rsc || 0,
    proxy: s.counts.proxy || 0,
    direct: s.counts.direct || 0,
    preflight: rec.preflights.length,
    session: s.counts.session || 0,
    csrf: s.counts.csrf || 0,
    sse: s.counts.sse || 0,
    dupRequests: s.dups.reduce((n, [, c]) => n + c - 1, 0),
    dupKeys: s.dups.map(([k, c]) => `${k} x${c}`).join(' | '),
    apiWaves: s.waves,
    docKB: Math.round((p.docBytes || 0) / 1024),
    docDecodedKB: Math.round((p.docDecoded || 0) / 1024),
    apiKB: Math.round(((s.bytes.proxy || 0) + (s.bytes.direct || 0)) / 1024),
    jsKB: Math.round((s.bytes.js || 0) / 1024),
    imageKB: Math.round((s.bytes.image || 0) / 1024),
    longTasks: lt.length,
    longTaskMs: Math.round(lt.reduce((a, t) => a + t.duration, 0)),
    blockingMs: Math.round(lt.reduce((a, t) => a + Math.max(0, t.duration - 50), 0)),
    maxLongTask: Math.round(Math.max(0, ...lt.map((t) => t.duration))),
    scriptMs: Math.round((m1.ScriptDuration || 0) * 1000),
    taskMs: Math.round((m1.TaskDuration || 0) * 1000),
    layoutMs: Math.round((m1.LayoutDuration || 0) * 1000),
    styleMs: Math.round((m1.RecalcStyleDuration || 0) * 1000),
    heapMB: Number(((m1.JSHeapUsedSize || 0) / 1048576).toFixed(1)),
    heapAfterGcMB: Number(((m2.JSHeapUsedSize || 0) / 1048576).toFixed(1)),
    domNodes: p.domNodes,
    reactCommits: p.commits,
    componentRenders: p.rendered,
  }
  await context.close()
  return { row, waterfall: s.waterfall, renders: p.renders, wall: Date.now() - wall0 }
}

/** Client-side navigation through the sidebar, one context. */
async function navFlow(browser, v, run) {
  const context = await browser.newContext({ storageState: v.storage })
  const all = pages(v.account)
  const byName = Object.fromEntries(all.map((p) => [p.name, p]))
  await context.addInitScript(`window.__perfConfig=${JSON.stringify({ marker: null, countRenders })};\n${INPAGE}`)
  const page = await context.newPage()
  const cdp = await context.newCDPSession(page)
  await cdp.send('Performance.enable', { timeDomain: 'timeTicks' })
  const rec = await recorder(page, cdp, v.backend)
  await page.goto(v.base + '/app', { waitUntil: 'load' })
  await page.waitForSelector(byName.dashboard.marker.selector, { timeout: 30000 })
  await waitQuiet(rec, page)
  const steps = ['transactions', 'accounts', 'analysis', 'investments', 'budget', 'dashboard', 'transactions', 'accounts', 'analysis']
  const rows = []
  const seen = new Set()
  for (const name of steps) {
    const pg = byName[name]
    const href = pg.path
    const before = rec.reqs.length
    const preBefore = rec.preflights.length
    const commitsBefore = await page.evaluate(() => window.__perf.commits.length)
    const link = page.locator(`a[href="${href}"]`).first()
    const t0 = Date.now()
    const tPage0 = await page.evaluate(() => performance.now())
    let error = ''
    try {
      await link.click({ timeout: 10000 })
      await page.waitForURL((u) => u.pathname === href, { timeout: 30000 })
      if (pg.marker.selector) await page.waitForSelector(pg.marker.selector, { timeout: 30000 })
      else await page.waitForFunction((src) => new RegExp(src).test(document.body.innerText), pg.marker.text.source, { timeout: 30000, polling: 'raf' })
    } catch (e) {
      error = String(e).slice(0, 100)
    }
    const visibleMs = Date.now() - t0
    await waitQuiet(rec, page)
    const stepReqs = rec.reqs.slice(before)
    const s = summarizeRequests(stepReqs, 0)
    const lt = await page.evaluate((t) => window.__perf.longTasks.filter((x) => x.start >= t), tPage0)
    const commits = (await page.evaluate(() => window.__perf.commits.length)) - commitsBefore
    rows.push({
      version: v.label,
      run,
      step: name,
      visit: seen.has(name) ? 'revisit' : 'first',
      error,
      dataVisibleMs: visibleMs,
      requests: stepReqs.length,
      rsc: s.counts.rsc || 0,
      proxy: s.counts.proxy || 0,
      direct: s.counts.direct || 0,
      preflight: rec.preflights.length - preBefore,
      session: s.counts.session || 0,
      js: s.counts.js || 0,
      rscKB: Math.round((s.bytes.rsc || 0) / 1024),
      apiKB: Math.round(((s.bytes.proxy || 0) + (s.bytes.direct || 0)) / 1024),
      apiCalls: stepReqs
        .filter((r) => ['proxy', 'direct'].includes(r.cls))
        .map((r) => new URL(r.url).pathname.replace('/api/backend', ''))
        .join(' '),
      longTaskMs: Math.round(lt.reduce((a, t) => a + t.duration, 0)),
      reactCommits: commits,
    })
    seen.add(name)
  }
  const m = await metrics(cdp)
  rows.forEach((r) => (r.heapEndMB = Number(((m.JSHeapUsedSize || 0) / 1048576).toFixed(1))))
  await context.close()
  return rows
}

const browser = await chromium.launch({ executablePath: CHROME_PATH, args: ['--no-sandbox'] })
const coldRows = []
const waterfalls = {}
const renders = {}
const flowRows = []
// Warm-up: the first request of each route after `next start` pays module
// loading/JIT (seen as 5x TTFB and thousands of extra React commits). Not recorded.
if (!args['no-warmup'])
  for (const v of versions)
    for (const pg of pages('ACCOUNT')) {
      if (only && !only.has(pg.name)) continue
      await coldLoad(browser, v, pg, 0)
    }
for (let run = 1; run <= runs; run++) {
  for (const pg of pages('ACCOUNT')) {
    if (only && !only.has(pg.name)) continue
    const order = run % 2 ? versions : [...versions].reverse()
    for (const v of order) {
      const r = await coldLoad(browser, v, pg, run)
      coldRows.push(r.row)
      if (run === 1) waterfalls[`${v.label}/${pg.name}`] = r.waterfall
      if (countRenders) renders[`${v.label}/${pg.name}/r${run}`] = r.renders
      console.log(
        `cold ${v.label.padEnd(6)} ${pg.name.padEnd(14)} r${run} visible=${r.row.dataVisible} lastData=${r.row.lastDataEnd} req=${r.row.requests} proxy=${r.row.proxy} direct=${r.row.direct} pre=${r.row.preflight} session=${r.row.session} dup=${r.row.dupRequests} waves=${r.row.apiWaves} lt=${r.row.longTaskMs} heap=${r.row.heapMB} ${r.row.error}`,
      )
      writeCsv(path.join(out, 'cold-loads.csv'), coldRows)
    }
  }
  if (!args['no-flow'])
    for (const v of run % 2 ? versions : [...versions].reverse()) {
      const rows = await navFlow(browser, v, run)
      flowRows.push(...rows)
      for (const r of rows) console.log(`nav  ${v.label.padEnd(6)} ${r.step.padEnd(14)} ${r.visit.padEnd(7)} visible=${r.dataVisibleMs} rsc=${r.rsc} api=${r.proxy + r.direct} session=${r.session} ${r.apiCalls} ${r.error}`)
      writeCsv(path.join(out, 'client-nav.csv'), flowRows)
    }
}
await browser.close()
fs.writeFileSync(path.join(out, 'waterfalls.json'), JSON.stringify(waterfalls, null, 1))
if (countRenders) fs.writeFileSync(path.join(out, 'renders.json'), JSON.stringify(renders, null, 1))

// Medians per version × page
const num = Object.keys(coldRows[0] || {}).filter((k) => typeof coldRows[0][k] === 'number' && k !== 'run')
const med = []
for (const pg of pages('x')) {
  for (const v of versions) {
    const rs = coldRows.filter((r) => r.page === pg.name && r.version === v.label)
    if (!rs.length) continue
    const m = { page: pg.name, version: v.label, n: rs.length }
    for (const k of num) m[k] = median(rs.map((r) => Number(r[k])).filter((x) => Number.isFinite(x)))
    med.push(m)
  }
}
writeCsv(path.join(out, 'cold-loads-medians.csv'), med)
if (flowRows.length) {
  const fm = []
  const keys = [...new Set(flowRows.map((r) => `${r.version}|${r.step}|${r.visit}`))]
  for (const k of keys) {
    const [version, step, visit] = k.split('|')
    const rs = flowRows.filter((r) => r.version === version && r.step === step && r.visit === visit)
    const m = { version, step, visit, n: rs.length }
    for (const c of ['dataVisibleMs', 'requests', 'rsc', 'proxy', 'direct', 'preflight', 'session', 'js', 'rscKB', 'apiKB', 'longTaskMs', 'reactCommits']) m[c] = median(rs.map((r) => r[c]))
    m.apiCalls = rs[0].apiCalls
    fm.push(m)
  }
  writeCsv(path.join(out, 'client-nav-medians.csv'), fm)
}
console.log(`wrote ${out}`)
