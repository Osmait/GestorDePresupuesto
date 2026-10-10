// Shared helpers for the perf/frontend scripts.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
export const REPO_ROOT = path.resolve(here, '../../..')

// Playwright comes from e2e-test/node_modules (run `npm ci` there first).
const require = createRequire(path.join(REPO_ROOT, 'e2e-test/package.json'))
export const { chromium } = require('playwright')

export const CHROME_PATH =
  process.env.CHROME_PATH || path.join(os.homedir(), '.cache/ms-playwright/chromium-1243/chrome-linux64/chrome')

export function parseArgs(argv = process.argv.slice(2)) {
  const out = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a.startsWith('--')) {
      const [k, v] = a.slice(2).split('=')
      if (v !== undefined) out[k] = v
      else if (argv[i + 1] && !argv[i + 1].startsWith('--')) out[k] = argv[++i]
      else out[k] = true
    } else out._.push(a)
  }
  return out
}

/** Pages measured by every script. `marker` = text/selector that means "data visible". */
export function pages(accountId) {
  return [
    { name: 'landing', path: '/', auth: false, marker: { selector: 'h1' } },
    { name: 'login', path: '/login', auth: false, marker: { selector: 'input[name="email"]' } },
    { name: 'dashboard', path: '/app', auth: true, marker: { selector: '#dashboard-charts svg' } },
    { name: 'transactions', path: '/app/transactions', auth: true, marker: { text: /(Gasto|Ingreso) #\d+/ } },
    { name: 'accounts', path: '/app/accounts', auth: true, marker: { text: /Cuenta Nomina/ } },
    { name: 'account-detail', path: `/app/accounts/${accountId}`, auth: true, marker: { text: /(Gasto|Ingreso) #\d+/ } },
    { name: 'analysis', path: '/app/analysis', auth: true, marker: { selector: 'main svg' } },
    { name: 'investments', path: '/app/investments', auth: true, marker: { text: /Apple|AAPL/ } },
    { name: 'budget', path: '/app/budget', auth: true, marker: { text: /Comida/ } },
  ]
}

export function quantile(values, q) {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b)
  if (v.length === 0) return NaN
  const pos = (v.length - 1) * q
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  return v[lo] + (v[hi] - v[lo]) * (pos - lo)
}
export const median = (v) => quantile(v, 0.5)
export const mean = (v) => v.reduce((s, x) => s + x, 0) / v.length

/**
 * Logs in through the real login form (credentials provider) and saves the
 * Playwright storage state. Returns { storageState, cookieHeader }.
 */
export async function login(baseURL, email, password, outFile) {
  const browser = await chromium.launch({ executablePath: CHROME_PATH })
  const context = await browser.newContext({ baseURL })
  const page = await context.newPage()
  await page.goto('/login')
  await page.locator('input[name="email"]').fill(email)
  await page.locator('input[name="password"]').fill(password)
  await page.locator('button[type="submit"]').first().click()
  await page.waitForURL(/\/app(\?|$|\/)/, { timeout: 60000 })
  // networkidle never fires: the app keeps an SSE stream (/notifications) open.
  await page.waitForTimeout(2000)
  await context.storageState({ path: outFile })
  const cookies = await context.cookies()
  await browser.close()
  return { storageState: outFile, cookieHeader: cookieHeader(cookies) }
}

export function cookieHeader(cookies) {
  return cookies
    .filter((c) => c.name.includes('authjs') || c.name.includes('next-auth') || c.name === 'NEXT_LOCALE')
    .map((c) => `${c.name}=${c.value}`)
    .join('; ')
}

export function readCookieHeader(storageFile) {
  const s = JSON.parse(fs.readFileSync(storageFile, 'utf8'))
  return cookieHeader(s.cookies)
}

export function writeCsv(file, rows) {
  if (rows.length === 0) return
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))]
  const esc = (v) => {
    const s = v === undefined || v === null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  fs.writeFileSync(file, [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n') + '\n')
}
