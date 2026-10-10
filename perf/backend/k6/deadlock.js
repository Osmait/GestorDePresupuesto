// Reproduces the connection-pool deadlock on feature-gated routes.
//
// RLSMiddleware opens a transaction (pins 1 pooled connection) and THEN the
// route-group middleware RequireFeature runs IsFeatureEnabled on the pool
// (featureflag.go:12) and needs a 2nd connection. With >= DB_MAX_OPEN_CONNS
// (25) such requests in flight every pooled connection is an open
// transaction whose goroutine waits for another connection: nobody can make
// progress. For POST requests the stall is permanent (the body is never read,
// so net/http never notices the client went away and never cancels the
// request context); GETs only unblock when the client gives up.
//
//   k6 run -e BASE=... -e VUS=30 -e KIND=post deadlock.js   # POST /credit-cards/:id/payments
//   k6 run -e BASE=... -e VUS=30 -e KIND=get  deadlock.js   # GET  /investments
//   k6 run -e BASE=... -e VUS=30 -e KIND=summary deadlock.js # GET /analytics/dashboard-summary
import http from 'k6/http';
import { Counter, Trend } from 'k6/metrics';
import { BASE, HEAVY, login, auth, pick } from './lib.js';

const VUS = Number(__ENV.VUS || 30);
const KIND = __ENV.KIND || 'post';
const ok = new Counter('ok_requests');
const failed = new Counter('failed_requests');
const lat = new Trend('req_latency', true);

export const options = {
  scenarios: { burst: { executor: 'constant-vus', vus: VUS, duration: __ENV.DURATION || '15s', gracefulStop: '0s' } },
  summaryTrendStats: ['med', 'p(95)', 'max', 'count'],
};

export function setup() { return { token: login(HEAVY.email).access_token }; }

export default function (d) {
  const p = Object.assign(auth(d.token), { timeout: '10s' });
  const r = KIND === 'post'
    ? http.post(`${BASE}/credit-cards/${pick(HEAVY.cards)}/payments`,
      JSON.stringify({ from_account_id: HEAVY.dopAccounts[0], currency: 'DOP', amount: 1, notes: 'k6-deadlock' }), p)
    : KIND === 'summary'
      // not feature-gated: on `main` the analytics/account repositories query
      // the pool while the request holds its RLS transaction -> same deadlock
      ? http.get(`${BASE}/analytics/dashboard-summary`, p)
      : http.get(`${BASE}/investments`, p);
  lat.add(r.timings.duration);
  if (r.status >= 200 && r.status < 300) ok.add(1); else failed.add(1);
}

export function handleSummary(data) {
  const m = data.metrics;
  const out = {
    kind: KIND, vus: VUS,
    ok: m.ok_requests ? m.ok_requests.values.count : 0,
    failed: m.failed_requests ? m.failed_requests.values.count : 0,
    latency: m.req_latency ? m.req_latency.values : null,
  };
  return { stdout: JSON.stringify(out) + '\n' };
}
