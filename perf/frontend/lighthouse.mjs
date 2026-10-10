#!/usr/bin/env node
// Runs Lighthouse 12 (performance category, default simulated throttling) for
// every page × version × form factor, interleaving versions so machine noise
// hits both equally, then writes medians.
//
//   node perf/frontend/lighthouse.mjs --out <dir> --runs 3 \
//     --version branch=http://127.0.0.1:13461,<dir>/auth-branch.cookie.txt \
//     --version main=http://127.0.0.1:13462,<dir>/auth-main.cookie.txt \
//     --account-branch <id> --account-main <id> [--pages dashboard,login] [--ff mobile,desktop]
//
// Auth pages get the session cookie via --extra-headers. Output:
//   <out>/lighthouse/<version>-<page>-<ff>-r<n>.report.{json,html}
//   <out>/lighthouse/lighthouse-runs.csv, lighthouse-medians.csv/.md
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { CHROME_PATH, median, pages, parseArgs, writeCsv } from './lib/common.mjs'

const args = parseArgs()
const out = path.join(args.out || './perf-results', 'lighthouse')
fs.mkdirSync(out, { recursive: true })
const runs = Number(args.runs || 3)
const versionsArg = [].concat(args.version || [])
// parseArgs keeps only the last --version; re-scan argv for all of them.
const vlist = []
for (let i = 0; i < process.argv.length; i++) if (process.argv[i] === '--version') vlist.push(process.argv[i + 1])
const versions = (vlist.length ? vlist : versionsArg).map((s) => {
  const [label, rest] = s.split('=')
  const [base, cookieFile] = rest.split(',')
  return { label, base, cookie: cookieFile ? fs.readFileSync(cookieFile, 'utf8').trim() : '', account: args[`account-${label}`] }
})
const formFactors = (args.ff || 'mobile,desktop').split(',')
const only = args.pages ? new Set(args.pages.split(',')) : null

const rows = []
const t0 = Date.now()
for (let r = 1; r <= runs; r++) {
  for (const ff of formFactors) {
    for (const pg of pages('ACCOUNT')) {
      if (only && !only.has(pg.name)) continue
      // alternate which version goes first each run
      const order = r % 2 ? versions : [...versions].reverse()
      for (const v of order) {
        const url = v.base + pg.path.replace('ACCOUNT', v.account)
        const base = path.join(out, `${v.label}-${pg.name}-${ff}-r${r}`)
        const headersFile = `${base}.headers.json`
        fs.writeFileSync(headersFile, JSON.stringify(pg.auth ? { Cookie: v.cookie } : {}))
        const lhArgs = [
          '-y',
          'lighthouse@12.8.2',
          url,
          '--only-categories=performance',
          '--output=json',
          '--output=html',
          `--output-path=${base}`,
          `--extra-headers=${headersFile}`,
          '--chrome-flags=--headless=new --no-sandbox --disable-gpu',
          '--quiet',
          // The app keeps an SSE stream (/notifications) open, so the network is
          // never quiet and Lighthouse would wait the whole max-wait; 25 s is plenty.
          '--max-wait-for-load=25000',
        ]
        if (ff === 'desktop') lhArgs.push('--preset=desktop')
        const res = spawnSync('npx', lhArgs, { env: { ...process.env, CHROME_PATH }, encoding: 'utf8', timeout: 180000 })
        fs.rmSync(headersFile, { force: true })
        let lhr
        try {
          lhr = JSON.parse(fs.readFileSync(`${base}.report.json`, 'utf8'))
        } catch {
          console.error(`FAILED ${v.label} ${pg.name} ${ff} r${r}: ${res.stderr?.slice(-500)}`)
          continue
        }
        const a = lhr.audits
        const net = a['network-requests']?.details?.items || []
        const row = {
          version: v.label,
          page: pg.name,
          ff,
          run: r,
          finalUrl: lhr.finalDisplayedUrl || lhr.finalUrl,
          score: Math.round((lhr.categories.performance.score ?? 0) * 100),
          fcp: Math.round(a['first-contentful-paint'].numericValue),
          lcp: Math.round(a['largest-contentful-paint'].numericValue),
          tbt: Math.round(a['total-blocking-time'].numericValue),
          cls: Number(a['cumulative-layout-shift'].numericValue.toFixed(3)),
          si: Math.round(a['speed-index'].numericValue),
          tti: Math.round(a.interactive?.numericValue ?? NaN),
          totalKB: Math.round((a['total-byte-weight'].numericValue || 0) / 1024),
          requests: net.length,
          jsKB: Math.round(net.filter((n) => n.resourceType === 'Script').reduce((s, n) => s + (n.transferSize || 0), 0) / 1024),
          bootupMs: Math.round(a['bootup-time']?.numericValue ?? NaN),
          mainThreadMs: Math.round(a['mainthread-work-breakdown']?.numericValue ?? NaN),
          unusedJsKB: Math.round((a['unused-javascript']?.details?.overallSavingsBytes ?? 0) / 1024),
          serverResponseMs: Math.round(a['server-response-time']?.numericValue ?? NaN),
          domSize: a['dom-size']?.numericValue ?? '',
          warnings: (lhr.runWarnings || []).length,
        }
        rows.push(row)
        console.log(
          `[${((Date.now() - t0) / 1000).toFixed(0)}s] ${v.label.padEnd(6)} ${pg.name.padEnd(14)} ${ff.padEnd(7)} r${r} score=${row.score} lcp=${row.lcp} tbt=${row.tbt} cls=${row.cls} url=${row.finalUrl}`,
        )
        writeCsv(path.join(out, 'lighthouse-runs.csv'), rows)
      }
    }
  }
}

// medians
const metrics = ['score', 'fcp', 'lcp', 'tbt', 'cls', 'si', 'tti', 'totalKB', 'requests', 'jsKB', 'bootupMs', 'mainThreadMs', 'unusedJsKB', 'serverResponseMs', 'domSize']
const med = []
for (const ff of formFactors)
  for (const pg of pages('x')) {
    if (only && !only.has(pg.name)) continue
    for (const v of versions) {
      const rs = rows.filter((r) => r.ff === ff && r.page === pg.name && r.version === v.label)
      if (!rs.length) continue
      const m = { ff, page: pg.name, version: v.label, n: rs.length }
      for (const k of metrics) m[k] = median(rs.map((r) => Number(r[k])))
      med.push(m)
    }
  }
writeCsv(path.join(out, 'lighthouse-medians.csv'), med)
let md = '| ff | page | version | n | score | FCP | LCP | TBT | CLS | SI | TTI | total KB | JS KB | req | bootup ms | unused JS KB | server ms |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|\n'
for (const m of med)
  md += `| ${m.ff} | ${m.page} | ${m.version} | ${m.n} | ${m.score} | ${m.fcp} | ${m.lcp} | ${m.tbt} | ${m.cls} | ${m.si} | ${m.tti} | ${m.totalKB} | ${m.jsKB} | ${m.requests} | ${m.bootupMs} | ${m.unusedJsKB} | ${m.serverResponseMs} |\n`
fs.writeFileSync(path.join(out, 'lighthouse-medians.md'), md)
console.log(md)
