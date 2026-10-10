#!/usr/bin/env node
// Measures the cost of the same-origin backend proxy (/api/backend/*) versus
// calling the Go backend directly, plus the session endpoint and the JWE
// session-cookie crypto that every proxied request pays.
//
//   node perf/frontend/proxy-bench.mjs --frontend http://127.0.0.1:13461 --backend http://127.0.0.1:18461 \
//     --cookie-file <dir>/auth-branch.cookie.txt [--main-frontend http://127.0.0.1:13462 --main-cookie-file <dir>/auth-main.cookie.txt \
//      --main-backend http://127.0.0.1:18462] [--n 200] [--gestor <path to FrontendNextjs/gestor>] --out <dir>
//
// All series are interleaved (direct, proxy, direct, ...) so drift and noise
// hit both equally. Node's fetch keeps connections alive, like a browser.
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { performance } from 'node:perf_hooks'
import { mean, parseArgs, quantile, writeCsv } from './lib/common.mjs'

const args = parseArgs()
const N = Number(args.n || 200)
const out = path.join(args.out || './perf-results', 'proxy')
fs.mkdirSync(out, { recursive: true })
const cookie = fs.readFileSync(args['cookie-file'], 'utf8').trim()
const mainCookie = args['main-cookie-file'] ? fs.readFileSync(args['main-cookie-file'], 'utf8').trim() : null
const email = args.email || 'heavy@perf.test'
const password = args.password || process.env.PERF_USER_PASSWORD
if (!password) throw new Error('set PERF_USER_PASSWORD or pass --password')

async function token(backend) {
  const r = await fetch(`${backend}/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) })
  return (await r.json()).access_token
}
async function timed(url, headers) {
  const t = performance.now()
  const r = await fetch(url, { headers })
  const body = await r.arrayBuffer()
  const ms = performance.now() - t
  if (!r.ok) throw new Error(`${url} -> ${r.status}`)
  return { ms, bytes: body.byteLength, setCookie: r.headers.get('set-cookie')?.length ?? 0 }
}
const stats = (xs) => ({ n: xs.length, mean: +mean(xs).toFixed(2), p50: +quantile(xs, 0.5).toFixed(2), p95: +quantile(xs, 0.95).toFixed(2), p99: +quantile(xs, 0.99).toFixed(2) })

const tokBranch = await token(args.backend)
const endpoints = (args.endpoints || '/exchange/rate,/account,/category,/transaction?page=1&limit=50&sort_by=created_at&sort_order=desc,/analytics/dashboard-summary,/notifications/history').split(',')
const rows = []
const result = { n: N, sequential: {}, burst: {}, session: {}, crypto: {} }

// 1) sequential, interleaved
for (const ep of endpoints) {
  const d = []
  const p = []
  let setCookie = 0
  let bytes = 0
  for (let i = 0; i < 20; i++) {
    await timed(`${args.backend}${ep}`, { authorization: `Bearer ${tokBranch}` })
    await timed(`${args.frontend}/api/backend${ep}`, { cookie })
  }
  for (let i = 0; i < N; i++) {
    const order = i % 2 ? ['d', 'p'] : ['p', 'd']
    for (const o of order) {
      if (o === 'd') d.push((await timed(`${args.backend}${ep}`, { authorization: `Bearer ${tokBranch}` })).ms)
      else {
        const r = await timed(`${args.frontend}/api/backend${ep}`, { cookie })
        p.push(r.ms)
        setCookie = r.setCookie
        bytes = r.bytes
      }
    }
  }
  const sd = stats(d)
  const sp = stats(p)
  result.sequential[ep] = { direct: sd, proxy: sp, overheadP50: +(sp.p50 - sd.p50).toFixed(2), overheadP95: +(sp.p95 - sd.p95).toFixed(2), responseBytes: bytes, setCookieBytes: setCookie }
  rows.push({ series: 'sequential', endpoint: ep, ...Object.fromEntries(Object.entries(sd).map(([k, v]) => [`direct_${k}`, v])), ...Object.fromEntries(Object.entries(sp).map(([k, v]) => [`proxy_${k}`, v])), overhead_p50: result.sequential[ep].overheadP50, overhead_p95: result.sequential[ep].overheadP95, bytes, setCookie })
  console.log(`seq ${ep.padEnd(40)} direct p50=${sd.p50} p95=${sd.p95} | proxy p50=${sp.p50} p95=${sp.p95} | +${result.sequential[ep].overheadP50}ms p50, Set-Cookie ${setCookie}B`)
}

// 2) bursts of 8 parallel requests (what a page load fires), interleaved
const burstEps = ['/account', '/category', '/budget', '/transaction?page=1&limit=50&sort_by=created_at&sort_order=desc', '/me/features', '/exchange/rate', '/analytics/dashboard-summary', '/notifications/history']
for (const mode of ['direct', 'proxy']) result.burst[mode] = { perRequest: [], wall: [] }
for (let i = 0; i < Math.max(30, N / 4); i++) {
  for (const mode of i % 2 ? ['direct', 'proxy'] : ['proxy', 'direct']) {
    const t = performance.now()
    const rs = await Promise.all(
      burstEps.map((ep) =>
        mode === 'direct' ? timed(`${args.backend}${ep}`, { authorization: `Bearer ${tokBranch}` }) : timed(`${args.frontend}/api/backend${ep}`, { cookie }),
      ),
    )
    result.burst[mode].wall.push(performance.now() - t)
    result.burst[mode].perRequest.push(...rs.map((r) => r.ms))
  }
}
for (const mode of ['direct', 'proxy']) {
  result.burst[mode] = { perRequest: stats(result.burst[mode].perRequest), wall: stats(result.burst[mode].wall) }
  rows.push({ series: `burst8-${mode}`, endpoint: burstEps.join(' '), ...Object.fromEntries(Object.entries(result.burst[mode].wall).map(([k, v]) => [`wall_${k}`, v])), ...Object.fromEntries(Object.entries(result.burst[mode].perRequest).map(([k, v]) => [`req_${k}`, v])) })
  console.log(`burst8 ${mode}: wall p50=${result.burst[mode].wall.p50} p95=${result.burst[mode].wall.p95}; per request p50=${result.burst[mode].perRequest.p50} p95=${result.burst[mode].perRequest.p95}`)
}

// 3) /api/auth/session (branch: SessionProvider mount, update(); main: every repository call)
const sess = { branch: [], main: [] }
let mainTok = null
const mainStyle = []
if (args['main-backend']) mainTok = await token(args['main-backend'])
for (let i = 0; i < N; i++) {
  sess.branch.push((await timed(`${args.frontend}/api/auth/session`, { cookie })).ms)
  if (mainCookie) {
    sess.main.push((await timed(`${args['main-frontend']}/api/auth/session`, { cookie: mainCookie })).ms)
    // main's browser repository: getSession() then the direct backend call, sequentially
    const t = performance.now()
    await timed(`${args['main-frontend']}/api/auth/session`, { cookie: mainCookie })
    await timed(`${args['main-backend']}/account`, { authorization: `Bearer ${mainTok}` })
    mainStyle.push(performance.now() - t)
  }
}
result.session.branch = stats(sess.branch)
if (mainCookie) {
  result.session.main = stats(sess.main)
  result.session.mainStyleAccountCall = stats(mainStyle)
}
console.log(`session branch p50=${result.session.branch.p50} p95=${result.session.branch.p95}` + (mainCookie ? ` | main p50=${result.session.main.p50} p95=${result.session.main.p95} | main-style getSession()+GET /account p50=${result.session.mainStyleAccountCall.p50} p95=${result.session.mainStyleAccountCall.p95}` : ''))
for (const k of Object.keys(result.session)) rows.push({ series: `session-${k}`, ...Object.fromEntries(Object.entries(result.session[k]).map(([a, b]) => [`req_${a}`, b])) })

// 4) in-process JWE crypto cost of the session cookie (decode = what readSessionJwt/auth() do; encode = auth() re-issuing the cookie)
if (args.gestor) {
  const req = createRequire(path.join(args.gestor, 'package.json'))
  const jwtPath = req.resolve('next-auth/jwt')
  const { decode, encode } = await import(jwtPath)
  const [name, ...rest] = cookie.split(';').find((c) => c.trim().startsWith('authjs.session-token')).trim().split('=')
  const value = rest.join('=')
  const secret = args.secret || 'perf-auth-secret-0123456789abcdef'
  const payload = await decode({ token: value, secret, salt: name })
  const ITER = 2000
  let t = performance.now()
  for (let i = 0; i < ITER; i++) await decode({ token: value, secret, salt: name })
  const decUs = ((performance.now() - t) / ITER) * 1000
  t = performance.now()
  for (let i = 0; i < ITER; i++) await encode({ token: payload, secret, salt: name })
  const encUs = ((performance.now() - t) / ITER) * 1000
  result.crypto = { cookieBytes: value.length, decodeUs: +decUs.toFixed(1), encodeUs: +encUs.toFixed(1), perProxiedRequestUs: +(2 * decUs + encUs).toFixed(1), note: 'proxy: auth() decode+encode, getBackendAccessToken decode again' }
  console.log(`crypto: cookie ${value.length}B decode ${decUs.toFixed(1)}us encode ${encUs.toFixed(1)}us`)
}

fs.writeFileSync(path.join(out, 'proxy-bench.json'), JSON.stringify(result, null, 1))
writeCsv(path.join(out, 'proxy-bench.csv'), rows.map((r) => ({ series: '', endpoint: '', ...r })))
console.log(`wrote ${out}`)
