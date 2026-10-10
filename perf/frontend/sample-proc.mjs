#!/usr/bin/env node
// Samples CPU% and RSS of the process listening on a port (e.g. next-server)
// once per second from /proc, until killed or --seconds elapse.
//
//   node perf/frontend/sample-proc.mjs --port 13461 --seconds 90 --out cpu-branch.csv
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import { parseArgs, writeCsv } from './lib/common.mjs'

const args = parseArgs()
const pid = args.pid || execSync(`ss -ltnpH "sport = :${args.port}"`).toString().match(/pid=(\d+)/)?.[1]
if (!pid) throw new Error(`no process on port ${args.port}`)
const hz = 100
const rows = []
const read = () => {
  const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8').split(') ')[1].split(' ')
  const ticks = Number(stat[11]) + Number(stat[12]) // utime + stime
  const rssKB = Number(fs.readFileSync(`/proc/${pid}/status`, 'utf8').match(/VmRSS:\s+(\d+)/)[1])
  return { ticks, rssKB }
}
let prev = read()
let prevT = Date.now()
const end = Date.now() + Number(args.seconds || 60) * 1000
const timer = setInterval(() => {
  const cur = read()
  const now = Date.now()
  rows.push({ t: Math.round((now - (end - Number(args.seconds || 60) * 1000)) / 1000), cpuPct: +((((cur.ticks - prev.ticks) / hz) * 100000) / (now - prevT)).toFixed(1), rssMB: +(cur.rssKB / 1024).toFixed(1) })
  prev = cur
  prevT = now
  if (now >= end) {
    clearInterval(timer)
    writeCsv(args.out || `proc-${pid}.csv`, rows)
    const cpu = rows.map((r) => r.cpuPct)
    console.log(JSON.stringify({ pid, samples: rows.length, cpuAvg: +(cpu.reduce((a, b) => a + b, 0) / cpu.length).toFixed(1), cpuMax: Math.max(...cpu), rssStartMB: rows[0].rssMB, rssMaxMB: Math.max(...rows.map((r) => r.rssMB)), rssEndMB: rows.at(-1).rssMB }))
  }
}, 1000)
