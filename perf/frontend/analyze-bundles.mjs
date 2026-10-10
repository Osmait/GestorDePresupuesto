#!/usr/bin/env node
// Summarises @next/bundle-analyzer client reports.
//
//   node perf/frontend/analyze-bundles.mjs <bundles-dir> <label> [<label> ...]
//
// Reads <bundles-dir>/analyzer-<label>-client.html and
// <bundles-dir>/app-build-manifest-<label>.json (both produced by build.sh) and
// writes <bundles-dir>/bundle-summary.md + bundle-summary.json with:
//   - biggest npm packages in the client bundle (parsed + gzip bytes)
//   - per-route first-load JS broken down by package (from the app build manifest)
//   - packages bundled more than once (nested node_modules / several copies)
import fs from 'node:fs'
import path from 'node:path'

const [dir, ...labels] = process.argv.slice(2)
if (!dir || labels.length === 0) {
  console.error('usage: analyze-bundles.mjs <bundles-dir> <label> [...]')
  process.exit(1)
}

const ROUTES = [
  '/page',
  '/login/page',
  '/app/page',
  '/app/transactions/page',
  '/app/accounts/page',
  '/app/accounts/[id]/page',
  '/app/analysis/page',
  '/app/investments/page',
  '/app/budget/page',
  '/app/certificates/page',
]

function loadChartData(file) {
  const html = fs.readFileSync(file, 'utf8')
  const m = html.match(/window\.chartData = (\[.*?\]);\s*\n/s) || html.match(/window\.chartData = (\[.*?\]);/s)
  if (!m) throw new Error(`no chartData in ${file}`)
  return JSON.parse(m[1])
}

/** npm package name for a module path, or a bucket for app code. */
function packageOf(p) {
  const parts = p.replace(/^\.\//, '').split('/')
  const idx = parts.lastIndexOf('node_modules')
  if (idx === -1) {
    if (parts[0] === 'components' || parts[0] === 'app' || parts[0] === 'lib' || parts[0] === 'hooks' || parts[0] === 'contexts' || parts[0] === 'messages')
      return `(app) ${parts[0]}/${parts[1] ?? ''}`.replace(/\/$/, '')
    return `(app) ${parts[0]}`
  }
  const name = parts[idx + 1]?.startsWith('@') ? `${parts[idx + 1]}/${parts[idx + 2]}` : parts[idx + 1]
  // Concatenated modules repeat node_modules in their path; the last segment is the real package.
  return name
}

function walk(node, chunk, out, prefix = '') {
  if (node.groups && node.groups.length) {
    for (const g of node.groups) walk(g, chunk, out, prefix)
    return
  }
  const p = node.path || node.label || ''
  // concatenated modules: path like "./node_modules/x/index.js + 12 modules (concatenated)"
  const clean = p.replace(/ \+ \d+ modules \(concatenated\)$/, '')
  out.push({ chunk, path: clean, parsed: node.parsedSize || 0, gzip: node.gzipSize || 0, stat: node.statSize || 0 })
}

function summarise(label) {
  const data = loadChartData(path.join(dir, `analyzer-${label}-client.html`))
  const modules = []
  const chunks = {}
  for (const asset of data) {
    chunks[asset.label] = { parsed: asset.parsedSize || 0, gzip: asset.gzipSize || 0 }
    walk(asset, asset.label, modules)
  }
  const pkgs = {}
  for (const m of modules) {
    const pkg = packageOf(m.path)
    const e = (pkgs[pkg] ??= { parsed: 0, gzip: 0, chunks: new Set() })
    e.parsed += m.parsed
    e.gzip += m.gzip
    e.chunks.add(m.chunk)
  }
  let manifest = {}
  try {
    manifest = JSON.parse(fs.readFileSync(path.join(dir, `app-build-manifest-${label}.json`), 'utf8')).pages
  } catch {}
  const routes = {}
  for (const r of ROUTES) {
    const files = (manifest[r] || []).filter((f) => f.endsWith('.js')).map((f) => f.replace(/^static\/chunks\//, 'static/chunks/'))
    const set = new Set(files)
    let parsed = 0
    let gzip = 0
    const byPkg = {}
    for (const f of set) {
      if (chunks[f]) {
        parsed += chunks[f].parsed
        gzip += chunks[f].gzip
      }
    }
    for (const m of modules) {
      if (!set.has(m.chunk)) continue
      const pkg = packageOf(m.path)
      byPkg[pkg] = (byPkg[pkg] || 0) + m.gzip
    }
    routes[r] = {
      chunks: set.size,
      parsed,
      gzip,
      top: Object.entries(byPkg)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 12),
    }
  }
  const pkgList = Object.entries(pkgs)
    .map(([name, v]) => ({ name, parsed: v.parsed, gzip: v.gzip, chunks: v.chunks.size }))
    .sort((a, b) => b.parsed - a.parsed)
  return { label, totalParsed: Object.values(chunks).reduce((s, c) => s + c.parsed, 0), totalGzip: Object.values(chunks).reduce((s, c) => s + c.gzip, 0), pkgList, routes, chunkCount: Object.keys(chunks).length }
}

const kb = (n) => (n / 1024).toFixed(1)
const results = labels.map(summarise)
let md = '# Client bundle summary (from @next/bundle-analyzer)\n\n'
md += '| version | client chunks | total parsed KB | total gzip KB |\n|---|---|---|---|\n'
for (const r of results) md += `| ${r.label} | ${r.chunkCount} | ${kb(r.totalParsed)} | ${kb(r.totalGzip)} |\n`

md += '\n## Biggest packages (whole client build, parsed / gzip KB, #chunks containing it)\n\n'
const allNames = new Set(results.flatMap((r) => r.pkgList.slice(0, 40).map((p) => p.name)))
md += `| package | ${results.map((r) => `${r.label} parsed | ${r.label} gzip | ${r.label} chunks`).join(' | ')} |\n`
md += `|---|${results.map(() => '---|---|---|').join('')}\n`
const sorted = [...allNames].sort((a, b) => (results[0].pkgList.find((p) => p.name === b)?.parsed || 0) - (results[0].pkgList.find((p) => p.name === a)?.parsed || 0))
for (const name of sorted.slice(0, 40)) {
  md += `| ${name} | ${results
    .map((r) => {
      const p = r.pkgList.find((x) => x.name === name)
      return p ? `${kb(p.parsed)} | ${kb(p.gzip)} | ${p.chunks}` : '- | - | -'
    })
    .join(' | ')} |\n`
}

md += '\n## Packages split across 4+ chunks (check `npm ls <pkg>` for real duplicate versions)\n\n'
for (const r of results) {
  const dups = r.pkgList.filter((p) => !p.name.startsWith('(app)') && p.chunks >= 4)
  md += `**${r.label}**: ${dups.map((d) => `${d.name} (${d.chunks} chunks, ${kb(d.parsed)} KB)`).join(', ') || 'none'}\n\n`
}

md += '\n## Per-route first-load JS (gzip KB, sum of chunks listed in app-build-manifest incl. shared)\n\n'
md += `| route | ${results.map((r) => `${r.label} gzip KB | ${r.label} chunks`).join(' | ')} |\n|---|${results.map(() => '---|---|').join('')}\n`
for (const route of ROUTES) {
  md += `| ${route} | ${results.map((r) => `${kb(r.routes[route].gzip)} | ${r.routes[route].chunks}`).join(' | ')} |\n`
}
for (const r of results) {
  md += `\n### ${r.label}: top packages per route (gzip KB)\n\n`
  for (const route of ROUTES) {
    md += `- \`${route}\`: ${r.routes[route].top.map(([n, g]) => `${n} ${kb(g)}`).join(', ')}\n`
  }
}
fs.writeFileSync(path.join(dir, 'bundle-summary.md'), md)
fs.writeFileSync(path.join(dir, 'bundle-summary.json'), JSON.stringify(results, null, 2))
console.log(md)
