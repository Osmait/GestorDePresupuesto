#!/usr/bin/env node
// Server-side cost of each route: document TTFB / total time / size and the
// RSC payload a client-side navigation downloads (RSC: 1), sequential and
// interleaved between versions.
//
//   node perf/frontend/server-bench.mjs --out <dir> --n 30 \
//     --version branch=http://127.0.0.1:13461,<dir>/auth-branch.cookie.txt,<accountId> \
//     --version main=http://127.0.0.1:13462,<dir>/auth-main.cookie.txt,<accountId>
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import zlib from 'node:zlib'
import { performance } from 'node:perf_hooks'
import { median, pages, parseArgs, quantile, writeCsv } from './lib/common.mjs'

const args = parseArgs()
const N = Number(args.n || 30)
const out = path.join(args.out || './perf-results', 'server')
fs.mkdirSync(out, { recursive: true })
const vlist = []
for (let i = 0; i < process.argv.length; i++) if (process.argv[i] === '--version') vlist.push(process.argv[i + 1])
const versions = vlist.map((s) => {
  const [label, rest] = s.split('=')
  const [base, cookieFile, account] = rest.split(',')
  return { label, base, cookie: fs.readFileSync(cookieFile, 'utf8').trim(), account }
})
const agent = new http.Agent({ keepAlive: true, maxSockets: 1 })

/** Raw http GET measuring time to first byte and total. */
function get(url, headers) {
  return new Promise((resolve, reject) => {
    const t0 = performance.now()
    let ttfb = null
    const chunks = []
    const req = http.get(url, { headers, agent }, (res) => {
      res.once('data', () => (ttfb = performance.now() - t0))
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => {
        const body = Buffer.concat(chunks)
        resolve({ status: res.statusCode, ttfb: ttfb ?? performance.now() - t0, total: performance.now() - t0, wire: body.length, enc: res.headers['content-encoding'] || '', body, location: res.headers.location })
      })
    })
    req.on('error', reject)
  })
}

const rows = []
const samples = {}
const routes = pages('ACCOUNT')
for (let i = 0; i < N + 3; i++) {
  for (const pg of routes) {
    for (const v of i % 2 ? versions : [...versions].reverse()) {
      const url = v.base + pg.path.replace('ACCOUNT', v.account)
      const h = { 'accept-encoding': 'gzip', ...(pg.auth ? { cookie: v.cookie } : {}) }
      const doc = await get(url, { ...h, accept: 'text/html' })
      const rsc = await get(url, { ...h, rsc: '1' })
      if (i < 3) continue // warm-up
      const k = `${v.label}|${pg.name}`
      const s = (samples[k] ??= { doc: [], docTotal: [], rsc: [], rscTotal: [], docWire: 0, docRaw: 0, rscWire: 0, rscRaw: 0, status: doc.status })
      s.doc.push(doc.ttfb)
      s.docTotal.push(doc.total)
      s.rsc.push(rsc.ttfb)
      s.rscTotal.push(rsc.total)
      s.docWire = doc.wire
      s.docRaw = doc.enc === 'gzip' ? zlib.gunzipSync(doc.body).length : doc.wire
      s.rscWire = rsc.wire
      s.rscRaw = rsc.enc === 'gzip' ? zlib.gunzipSync(rsc.body).length : rsc.wire
      s.status = doc.status
    }
  }
}
for (const [k, s] of Object.entries(samples)) {
  const [version, page] = k.split('|')
  rows.push({
    version,
    page,
    status: s.status,
    docTtfbP50: +median(s.doc).toFixed(1),
    docTtfbP95: +quantile(s.doc, 0.95).toFixed(1),
    docTotalP50: +median(s.docTotal).toFixed(1),
    docKBgz: +(s.docWire / 1024).toFixed(1),
    docKBraw: +(s.docRaw / 1024).toFixed(1),
    rscTtfbP50: +median(s.rsc).toFixed(1),
    rscTotalP50: +median(s.rscTotal).toFixed(1),
    rscKBgz: +(s.rscWire / 1024).toFixed(1),
    rscKBraw: +(s.rscRaw / 1024).toFixed(1),
  })
}
rows.sort((a, b) => (a.page + a.version).localeCompare(b.page + b.version))
writeCsv(path.join(out, 'server-routes.csv'), rows)
console.table(rows)
