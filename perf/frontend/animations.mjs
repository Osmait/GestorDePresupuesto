#!/usr/bin/env node
// Lists animations still running N seconds after load (CSS animations,
// transitions and WAAPI/framer-motion) and how much main-thread time the idle
// page burns per second, to find never-ending animations that keep the
// compositor/painter busy.
//
//   node perf/frontend/animations.mjs --base <url> --storage <auth.json> --paths /app,/app/transactions [--wait 6]
import { CHROME_PATH, chromium, parseArgs } from './lib/common.mjs'

const args = parseArgs()
const wait = Number(args.wait || 6) * 1000
const browser = await chromium.launch({ executablePath: CHROME_PATH, args: ['--no-sandbox'] })
const context = await browser.newContext(args.storage ? { storageState: args.storage } : {})
const out = {}
for (const p of (args.paths || '/app').split(',')) {
  const page = await context.newPage()
  const cdp = await context.newCDPSession(page)
  await cdp.send('Performance.enable')
  await page.goto(args.base + p, { waitUntil: 'load' })
  await page.waitForTimeout(wait)
  const get = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]))
  const a = await get()
  await page.waitForTimeout(5000)
  const b = await get()
  const anims = await page.evaluate(() =>
    document.getAnimations().map((an) => {
      const t = an.effect && an.effect.target
      const timing = an.effect && an.effect.getComputedTiming ? an.effect.getComputedTiming() : {}
      return {
        kind: an.constructor.name,
        name: an.animationName || an.transitionProperty || an.id || '',
        state: an.playState,
        iterations: timing.iterations,
        target: t ? `${t.tagName.toLowerCase()}.${String(t.className && t.className.baseVal !== undefined ? t.className.baseVal : t.className).slice(0, 80)}` : '',
      }
    }),
  )
  out[p] = {
    idleTaskMsPerSec: Math.round(((b.TaskDuration - a.TaskDuration) * 1000) / 5),
    idleScriptMsPerSec: Math.round(((b.ScriptDuration - a.ScriptDuration) * 1000) / 5),
    idleLayoutsPerSec: (b.LayoutCount - a.LayoutCount) / 5,
    idleStyleRecalcsPerSec: (b.RecalcStyleCount - a.RecalcStyleCount) / 5,
    running: anims.filter((x) => x.state === 'running'),
  }
  await page.close()
}
await browser.close()
console.log(JSON.stringify(out, null, 1))
