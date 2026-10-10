// Light k6 load against `next start`: a logged-in user opening app pages
// (document + the API calls each page makes through the proxy, or directly
// against the backend for `main`). Keep it light: other services share the box.
//
//   docker run --rm -i --network host -v $PWD/perf/frontend/k6:/scripts grafana/k6 run \
//     -e BASE=http://127.0.0.1:13461 -e COOKIE="$(cat auth-branch.cookie.txt)" -e MODE=proxy \
//     [-e BACKEND=http://127.0.0.1:18462 -e TOKEN=<jwt> -e MODE=direct] -e VUS=5 -e DURATION=60s \
//     --summary-export /scripts/out.json /scripts/pages.js
import http from 'k6/http'
import { check, sleep } from 'k6'

const BASE = __ENV.BASE
const COOKIE = __ENV.COOKIE
const MODE = __ENV.MODE || 'proxy'
const BACKEND = __ENV.BACKEND
const TOKEN = __ENV.TOKEN

export const options = {
  vus: Number(__ENV.VUS || 5),
  duration: __ENV.DURATION || '60s',
  thresholds: { http_req_failed: ['rate<0.01'] },
}

const PAGES = [
  ['/app', ['/me/features', '/notifications/history']],
  ['/app/transactions', ['/account', '/category', '/budget', '/transaction', '/transaction?page=1&limit=50&sort_by=created_at&sort_order=desc&include_summary=true', '/me/features', '/notifications/history']],
  ['/app/accounts', ['/account', '/me/features', '/notifications/history']],
  ['/app/budget', ['/budget', '/category', '/me/features', '/notifications/history']],
]

function api(path) {
  if (MODE === 'direct') return [`${BACKEND}${path}`, { headers: { Authorization: `Bearer ${TOKEN}` }, tags: { kind: 'api' } }]
  return [`${BASE}/api/backend${path}`, { headers: { Cookie: COOKIE }, tags: { kind: 'api' } }]
}

export default function () {
  for (const [page, calls] of PAGES) {
    const res = http.get(`${BASE}${page}`, { headers: { Cookie: COOKIE, Accept: 'text/html', 'Accept-Encoding': 'gzip' }, tags: { kind: 'document', page } })
    check(res, { 'document 200': (r) => r.status === 200 })
    const reqs = calls.map((c) => {
      const [url, params] = api(c)
      return ['GET', url, null, params]
    })
    // main's browser repositories call getSession() (GET /api/auth/session on
    // the Next server) before every backend call: model that load too.
    if (MODE === 'direct')
      for (let i = 0; i < calls.length; i++) reqs.push(['GET', `${BASE}/api/auth/session`, null, { headers: { Cookie: COOKIE }, tags: { kind: 'session' } }])
    const rs = http.batch(reqs)
    for (const r of rs) check(r, { 'api 200': (x) => x.status === 200 })
    sleep(1)
  }
}
