#!/usr/bin/env node
// Detects runaway React re-render loops: loads a page and samples the number of
// React commits and CDP ScriptDuration over time (a settled page stays flat).
//
//   node perf/frontend/commit-loop.mjs --base <url> --storage <auth.json> --path /app [--seconds 12] [--out file.json]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { CHROME_PATH, chromium, parseArgs } from './lib/common.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const INPAGE = fs.readFileSync(path.join(here, 'lib/inpage.js'), 'utf8')
const args = parseArgs()
const seconds = Number(args.seconds || 12)
const browser = await chromium.launch({ executablePath: CHROME_PATH, args: ['--no-sandbox'] })
const context = await browser.newContext({ storageState: args.storage })
await context.addInitScript(`window.__perfConfig=${JSON.stringify({ marker: null, countRenders: !!args.react })};\n${INPAGE}`)
const page = await context.newPage()
const cdp = await context.newCDPSession(page)
await cdp.send('Performance.enable')
const t0 = Date.now()
await page.goto(args.base + (args.path || '/app'), { waitUntil: 'load' })
const samples = []
for (let s = 1; s <= seconds; s++) {
  await page.waitForTimeout(1000)
  const commits = await page.evaluate(() => window.__perf.commits.length)
  const { metrics } = await cdp.send('Performance.getMetrics')
  const m = Object.fromEntries(metrics.map((x) => [x.name, x.value]))
  samples.push({ t: Date.now() - t0, commits, scriptMs: Math.round(m.ScriptDuration * 1000), taskMs: Math.round(m.TaskDuration * 1000), heapMB: +(m.JSHeapUsedSize / 1048576).toFixed(1) })
}
let top = null
if (args.react) {
  top = await page.evaluate(() =>
    Object.entries(window.__perf.renders)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 25),
  )
}
await browser.close()
const result = { base: args.base, path: args.path || '/app', samples, top }
if (args.out) fs.writeFileSync(args.out, JSON.stringify(result, null, 1))
console.log(JSON.stringify(result, null, 1))
