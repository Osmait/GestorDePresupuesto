#!/usr/bin/env node
// React re-render hotspots during load and typical interactions, counted with
// a minimal React DevTools hook (lib/inpage.js). Against a normal production
// build component names are minified; build with `next build --profile`
// (perf/frontend/README.md) to get real names and per-component self time.
//
//   node perf/frontend/interactions.mjs --base http://127.0.0.1:13461 --storage <auth.json> \
//        --backend http://127.0.0.1:18461 --label branch --out <dir>
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { CHROME_PATH, chromium, parseArgs } from './lib/common.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const INPAGE = fs.readFileSync(path.join(here, 'lib/inpage.js'), 'utf8')
const args = parseArgs()
const label = args.label || 'branch'
const out = path.join(args.out || './perf-results', 'interactions')
fs.mkdirSync(out, { recursive: true })

const browser = await chromium.launch({ executablePath: CHROME_PATH, args: ['--no-sandbox'] })
const result = {}

async function newPage() {
  const context = await browser.newContext({ storageState: args.storage })
  await context.addInitScript(`window.__perfConfig=${JSON.stringify({ marker: null, countRenders: true })};\n${INPAGE}`)
  const page = await context.newPage()
  const reqs = []
  page.on('request', (r) => {
    const u = new URL(r.url())
    let cls = 'other'
    if (u.searchParams.has('_rsc') || r.headers().rsc === '1') cls = 'rsc'
    else if (u.pathname.startsWith('/api/backend/') && !u.pathname.endsWith('/notifications')) cls = 'api'
    else if (args.backend && r.url().startsWith(args.backend) && u.pathname !== '/notifications') cls = 'api'
    else if (u.pathname === '/api/auth/session') cls = 'session'
    reqs.push({ cls, path: u.pathname + u.search, t: Date.now() })
  })
  return { context, page, reqs }
}
async function snapshot(page) {
  return page.evaluate(() => {
    const p = window.__perf
    const top = Object.entries(p.renders).sort((a, b) => b[1].count - a[1].count)
    const bySelf = Object.entries(p.renders).sort((a, b) => b[1].selfMs - a[1].selfMs)
    const lt = p.longTasks
    return {
      commits: p.commits.length,
      componentRenders: top.reduce((s, [, v]) => s + v.count, 0),
      longTaskMs: Math.round(lt.reduce((s, t) => s + t.duration, 0)),
      topByCount: top.slice(0, 20).map(([n, v]) => [n, v.count, +v.selfMs.toFixed(1)]),
      topBySelfMs: bySelf.slice(0, 12).map(([n, v]) => [n, v.count, +v.selfMs.toFixed(1)]),
    }
  })
}
async function reset(page) {
  await page.evaluate(() => {
    window.__perf.renders = {}
    window.__perf.commits = []
    window.__perf.longTasks = []
  })
}
const phaseReqs = (reqs, since) => {
  const r = reqs.filter((x) => x.t >= since)
  const c = {}
  for (const x of r) c[x.cls] = (c[x.cls] || 0) + 1
  return { counts: c, api: r.filter((x) => x.cls === 'api' || x.cls === 'rsc').map((x) => `${x.cls}:${x.path.slice(0, 110)}`) }
}

// --- dashboard: load, then click through the tabs
{
  const { context, page, reqs } = await newPage()
  await page.goto(args.base + '/app', { waitUntil: 'load' })
  await page.waitForSelector('#dashboard-charts svg', { timeout: 30000 })
  await page.waitForTimeout(2500)
  result.dashboardLoad = await snapshot(page)
  await reset(page)
  const t0 = Date.now()
  const tabs = page.getByRole('tab')
  const n = await tabs.count()
  for (let i = n - 1; i >= 0; i--) {
    await tabs.nth(i).click()
    await page.waitForTimeout(600)
  }
  result.dashboardTabs = { tabs: n, ...(await snapshot(page)), requests: phaseReqs(reqs, t0) }
  await context.close()
}

// --- transactions: load, open filters, type a search term char by char
{
  const { context, page, reqs } = await newPage()
  await page.goto(args.base + '/app/transactions', { waitUntil: 'load' })
  await page.waitForFunction(() => /(Gasto|Ingreso) #\d+/.test(document.body.innerText), null, { timeout: 30000, polling: 'raf' })
  await page.waitForTimeout(2500)
  result.transactionsLoad = await snapshot(page)
  await page.getByRole('button', { name: /Filtrar|Filters?/i }).first().click()
  const input = page.getByPlaceholder(/Buscar por descripci|Search by description/i)
  await input.waitFor({ timeout: 10000 })
  await page.waitForTimeout(800)
  await reset(page)
  const t0 = Date.now()
  await input.pressSequentially('Gasto 12', { delay: 120 })
  await page.waitForTimeout(2500)
  result.transactionsTyping = { typed: 'Gasto 12', keystrokes: 8, ...(await snapshot(page)), requests: phaseReqs(reqs, t0) }
  await context.close()
}

// --- client-side navigation dashboard -> transactions -> dashboard (render cost of a route change)
{
  const { context, page, reqs } = await newPage()
  await page.goto(args.base + '/app', { waitUntil: 'load' })
  await page.waitForSelector('#dashboard-charts svg', { timeout: 30000 })
  await page.waitForTimeout(2000)
  await reset(page)
  const t0 = Date.now()
  await page.locator('a[href="/app/transactions"]').first().click()
  await page.waitForFunction(() => /(Gasto|Ingreso) #\d+/.test(document.body.innerText), null, { timeout: 30000, polling: 'raf' })
  await page.waitForTimeout(2000)
  result.navToTransactions = { ...(await snapshot(page)), requests: phaseReqs(reqs, t0) }
  await context.close()
}

await browser.close()
fs.writeFileSync(path.join(out, `interactions-${label}.json`), JSON.stringify(result, null, 1))
for (const [k, v] of Object.entries(result)) {
  console.log(`== ${label} ${k}: commits=${v.commits} componentRenders=${v.componentRenders} longTaskMs=${v.longTaskMs} ${v.requests ? JSON.stringify(v.requests.counts) : ''}`)
  console.log('   top by count:', v.topByCount.slice(0, 10).map((x) => x.join(':')).join('  '))
  if (v.topBySelfMs[0] && v.topBySelfMs[0][2] > 0) console.log('   top by self ms:', v.topBySelfMs.slice(0, 8).map((x) => x.join(':')).join('  '))
}
