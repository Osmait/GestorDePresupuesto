// SSE connection overhead: hold CONNS open GET /notifications streams (spread
// over the 200 light users) while a probe hits GET /category at PROBE_RPS.
// Compare probe latency with CONNS=0 vs CONNS=500/1000 and read the server's
// goroutines / heap from the pprof /debug/runtime endpoint (scripts/sse.sh).
//
//   k6 run -e BASE=... -e CONNS=500 -e HOLD=40 -e OUT=/out/sse-branch-500.json sse.js
import http from 'k6/http';
import exec from 'k6/execution';
import { Trend, Rate, Counter } from 'k6/metrics';
import { BASE, HEAVY, light, login, auth } from './lib.js';

const CONNS = Number(__ENV.CONNS || 500);
const HOLD = Number(__ENV.HOLD || 40);
const PROBE_RPS = Number(__ENV.PROBE_RPS || 50);
const OUT = __ENV.OUT || '';

const probeLat = new Trend('probe_latency', true);
const probeErr = new Rate('probe_errors');
const sseOpened = new Counter('sse_streams');

const scenarios = {
  probe: {
    executor: 'constant-arrival-rate', exec: 'probe', rate: PROBE_RPS, timeUnit: '1s',
    duration: `${HOLD - 10}s`, startTime: '8s', preAllocatedVUs: 50, maxVUs: 200,
  },
};
if (CONNS > 0) {
  scenarios.streams = {
    executor: 'per-vu-iterations', exec: 'stream', vus: CONNS, iterations: 1, maxDuration: `${HOLD + 5}s`,
  };
}

export const options = {
  scenarios,
  summaryTrendStats: ['avg', 'med', 'p(95)', 'p(99)', 'max', 'count'],
  setupTimeout: '180s',
};

export function setup() {
  const tokens = [];
  for (let u = 1; u <= 200; u++) tokens.push(login(light(u).email).access_token);
  return { heavy: login(HEAVY.email).access_token, tokens };
}

export function stream(d) {
  const token = d.tokens[(exec.vu.idInTest - 1) % d.tokens.length];
  sseOpened.add(1);
  // blocks until the timeout: the stream never ends on its own
  http.get(`${BASE}/notifications`, Object.assign(auth(token, { Accept: 'text/event-stream' }),
    { timeout: `${HOLD}s`, tags: { name: 'sse' }, responseType: 'none' }));
}

export function probe(d) {
  const r = http.get(`${BASE}/category`, Object.assign(auth(d.heavy), { tags: { name: 'probe' } }));
  probeLat.add(r.timings.duration);
  probeErr.add(r.status !== 200);
}

export function handleSummary(data) {
  const l = data.metrics.probe_latency;
  const e = data.metrics.probe_errors;
  const out = {
    conns: CONNS, probe_rps: PROBE_RPS,
    probe: l ? { count: l.values.count, p50: l.values.med, p95: l.values['p(95)'], p99: l.values['p(99)'], max: l.values.max } : null,
    probe_error_rate: e ? e.values.rate : null,
  };
  const res = { stdout: JSON.stringify(out) + '\n' };
  if (OUT) res[OUT] = JSON.stringify(out, null, 1);
  return res;
}
