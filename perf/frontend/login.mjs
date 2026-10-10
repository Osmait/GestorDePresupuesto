#!/usr/bin/env node
// Logs in through the UI and stores the Playwright storage state + cookie header.
//
//   node perf/frontend/login.mjs --base http://127.0.0.1:13461 --out <dir>/auth-branch.json \
//        [--email heavy@perf.test] [--password <pw>]  (default: $PERF_USER_PASSWORD)
import fs from 'node:fs'
import { login, parseArgs } from './lib/common.mjs'

const args = parseArgs()
const base = args.base
const out = args.out
if (!base || !out) {
  console.error('usage: login.mjs --base <frontend-url> --out <storage-state.json>')
  process.exit(1)
}
const { cookieHeader } = await login(base, args.email || 'heavy@perf.test', args.password || process.env.PERF_USER_PASSWORD, out)
fs.writeFileSync(out.replace(/\.json$/, '.cookie.txt'), cookieHeader)
console.log(`logged in on ${base}; cookie header length=${cookieHeader.length} bytes`)
