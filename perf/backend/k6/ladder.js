// Step-ladder load test for one endpoint (or the mixed workload).
//
//   k6 run -e BASE=http://127.0.0.1:18441 -e EP=accounts -e RATES=20,50,100 \
//          -e STEP=10 -e OUT=/out/accounts-branch-r1.json ladder.js
//
// Each step runs at a constant arrival rate for STEP seconds (open model: a
// slow server does not slow the generator down). Every measured request is
// tagged with its step, so the summary gives p50/p95/p99, achieved RPS and
// error rate per step. The first WARM seconds of each step (the ramp between
// rates) are excluded. "Max sustainable RPS" = highest step whose p95 < 300ms,
// error rate < 1% and achieved >= 95% of the target rate.
import http from 'k6/http';
import exec from 'k6/execution';
import { Trend, Rate, Counter } from 'k6/metrics';
import { BASE, PASSWORD, HEAVY, light, login, auth, pick, pid, MONTH_FROM, MONTH_TO, YEAR_FROM, TODAY } from './lib.js';

const EP = __ENV.EP || 'accounts';
const RATES = (__ENV.RATES || '20,50,100').split(',').map(Number);
const STEP = Number(__ENV.STEP || 10);
const WARM = Number(__ENV.WARM || 2);
const OUT = __ENV.OUT || '';
const LIGHT_USERS = Number(__ENV.LIGHT_USERS || 50);
const MAX_VUS = Number(__ENV.MAX_VUS || 800);
const WARMUP = Number(__ENV.WARMUP || 6); // seconds at RATES[0] before step 0, not measured
// share of mixed-workload requests issued by the heavy user (rest: light users)
const HEAVY_SHARE = Number(__ENV.HEAVY_SHARE || 0.3);

const lat = new Trend('ep_latency', true);
const errs = new Rate('ep_errors');
const reqs = new Counter('ep_reqs');

// ramping-arrival-rate stages: 1s ramp to each rate, then hold.
const stages = [{ target: RATES[0], duration: `${WARMUP}s` }];
for (const r of RATES) {
  stages.push({ target: r, duration: '1s' });
  stages.push({ target: r, duration: `${STEP - 1}s` });
}

const MIXED_OPS = ['accounts', 'budgets', 'dash_summary', 'tx_recent', 'tx_list_name', 'analytics_cat_1y', 'categories', 'create_tx', 'cc_payment', 'update_tx'];

const thresholds = {};
RATES.forEach((_, i) => {
  thresholds[`ep_latency{step:${i}}`] = ['p(95)<300'];
  thresholds[`ep_errors{step:${i}}`] = ['rate<0.01'];
  thresholds[`ep_reqs{step:${i}}`] = ['count>=0'];
  if (EP === 'mixed') {
    for (const op of MIXED_OPS) {
      thresholds[`ep_latency{step:${i},op:${op}}`] = ['p(95)<300'];
      thresholds[`ep_errors{step:${i},op:${op}}`] = ['rate<0.01'];
    }
  }
});

export const options = {
  discardResponseBodies: false,
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max', 'count'],
  thresholds,
  scenarios: {
    ladder: {
      executor: 'ramping-arrival-rate',
      startRate: RATES[0],
      timeUnit: '1s',
      preAllocatedVUs: Math.min(MAX_VUS, Math.max(20, RATES[RATES.length - 1])),
      maxVUs: MAX_VUS,
      stages,
    },
  },
  setupTimeout: '120s',
};

export function setup() {
  const heavy = login(HEAVY.email).access_token;
  const lights = [];
  for (let u = 1; u <= LIGHT_USERS; u++) lights.push(login(light(u).email).access_token);
  // warm the exchange-rate cache (external API, cached 1h in-process)
  http.get(`${BASE}/budget`, Object.assign(auth(heavy), { tags: { phase: 'setup' } }));
  // ids of transactions the heavy user can update
  const r = http.get(`${BASE}/transaction?page=1&limit=100&sort_by=created_at&sort_order=desc`, auth(heavy));
  const txs = (r.json('data') || []).map((t) => ({ id: t.id, account_id: t.account_id, category_id: t.category_id, currency: t.currency }));
  return { heavy, lights, txs };
}

let refreshToken = null;

function stepTag() {
  const elapsed = (Date.now() - exec.scenario.startTime) / 1000 - WARMUP;
  if (elapsed < 0) return null;
  const i = Math.floor(elapsed / STEP);
  if (i >= RATES.length || elapsed - i * STEP < WARM) return null;
  return String(i);
}

// u = {token, dop: [account ids], cats: [expense category ids]}
function heavyCtx(d) { return { token: d.heavy, dop: HEAVY.dopAccounts, cats: HEAVY.expenseCategories, heavy: true }; }
function mixedCtx(d) {
  if (Math.random() < HEAVY_SHARE) return heavyCtx(d);
  const i = Math.floor(Math.random() * d.lights.length);
  const l = light(i + 1);
  return { token: d.lights[i], dop: [l.account], cats: l.categories, heavy: false };
}

function get(token, path, name) {
  return http.get(`${BASE}${path}`, Object.assign(auth(token), { tags: { name } }));
}

const OPS = {
  accounts: (d, u) => get(u.token, '/account', 'accounts'),
  categories: (d, u) => get(u.token, '/category', 'categories'),
  budgets: (d, u) => get(u.token, '/budget', 'budgets'),
  dash_summary: (d, u) => get(u.token, `/analytics/dashboard-summary?date_from=${MONTH_FROM}&date_to=${MONTH_TO}`, 'dash_summary'),
  tx_recent: (d, u) => get(u.token, `/transaction?page=1&limit=100&sort_by=created_at&sort_order=desc&date_from=${MONTH_FROM}&date_to=${MONTH_TO}`, 'tx_recent'),
  tx_list_name: (d, u) => get(u.token, `/transaction?page=${1 + Math.floor(Math.random() * 50)}&limit=20&sort_by=transaction_name&sort_order=asc&type=bill&date_from=${YEAR_FROM}&date_to=${TODAY}`, 'tx_list_name'),
  analytics_cat_1y: (d, u) => get(u.token, `/analytics/category-expenses?date_from=${YEAR_FROM}&date_to=${TODAY}`, 'analytics_cat_1y'),
  analytics_summary_1y: (d, u) => get(u.token, `/analytics/dashboard-summary?date_from=${YEAR_FROM}&date_to=${TODAY}`, 'analytics_summary_1y'),
  analytics_monthly: (d, u) => get(u.token, '/analytics/monthly-summary', 'analytics_monthly'),
  create_tx: (d, u) => http.post(`${BASE}/transaction`, JSON.stringify({
    name: 'k6 tx', description: 'perf', amount: 12.34, type_transation: 'bill',
    account_id: pick(u.dop), category_id: pick(u.cats), currency: 'DOP',
  }), Object.assign(auth(u.token), { tags: { name: 'create_tx' } })),
  update_tx: (d) => {
    const t = pick(d.txs);
    return http.put(`${BASE}/transaction/${t.id}`, JSON.stringify({
      name: 'k6 upd', description: 'perf', amount: 10 + Math.round(Math.random() * 1000) / 100, type_transation: 'bill',
      account_id: t.account_id, category_id: t.category_id, currency: t.currency,
    }), Object.assign(auth(d.heavy), { tags: { name: 'update_tx' } }));
  },
  cc_payment: (d) => http.post(`${BASE}/credit-cards/${pick(HEAVY.cards)}/payments`, JSON.stringify({
    from_account_id: HEAVY.dopAccounts[0], currency: 'DOP', amount: 10, notes: 'k6',
  }), Object.assign(auth(d.heavy), { tags: { name: 'cc_payment' } })),
  login: () => http.post(`${BASE}/auth/login`, JSON.stringify({ email: light(1 + Math.floor(Math.random() * 200)).email, password: PASSWORD }),
    { headers: { 'Content-Type': 'application/json' }, tags: { name: 'login' } }),
  refresh: () => {
    if (!refreshToken) refreshToken = login(light(1 + (exec.vu.idInTest % 200)).email, { name: 'refresh_login' }).refresh_token;
    const res = http.post(`${BASE}/auth/refresh`, JSON.stringify({ refresh_token: refreshToken }),
      { headers: { 'Content-Type': 'application/json' }, tags: { name: 'refresh' } });
    if (res.status === 200) refreshToken = res.json('refresh_token');
    else refreshToken = null;
    return res;
  },
  light_tx_list: (d) => get(pick(d.lights), '/transaction?page=1&limit=20', 'light_tx_list'),
  // The real dashboard page load (FrontendNextjs app/app/page.tsx): accounts,
  // categories, budgets and dashboard-summary in parallel plus ALL of this
  // month's transactions fetched 100 per page (findAllSimple).
  dashboard: (d) => {
    const t0 = Date.now();
    const p = auth(d.heavy);
    const txUrl = (page) => `${BASE}/transaction?date_from=${MONTH_FROM}&date_to=${MONTH_TO}&page=${page}&limit=100&sort_by=created_at&sort_order=desc`;
    const rs = http.batch([
      ['GET', `${BASE}/account`, null, Object.assign({}, p, { tags: { name: 'd_accounts' } })],
      ['GET', `${BASE}/category`, null, Object.assign({}, p, { tags: { name: 'd_categories' } })],
      ['GET', `${BASE}/budget`, null, Object.assign({}, p, { tags: { name: 'd_budgets' } })],
      ['GET', `${BASE}/analytics/dashboard-summary?date_from=${MONTH_FROM}&date_to=${MONTH_TO}`, null, Object.assign({}, p, { tags: { name: 'd_summary' } })],
      ['GET', txUrl(1), null, Object.assign({}, p, { tags: { name: 'd_tx' } })],
    ]);
    let ok = rs.every((r) => r.status === 200);
    let page = 1;
    let last = rs[4];
    while (ok && last.json('pagination.has_next_page') && page < 100) {
      page++;
      last = http.get(txUrl(page), Object.assign({}, p, { tags: { name: 'd_tx' } }));
      ok = last.status === 200;
    }
    return { status: ok ? 200 : 599, timings: { duration: Date.now() - t0 } };
  },
};

const MIX = [
  // 80% reads
  ['accounts', 12], ['budgets', 10], ['dash_summary', 12], ['tx_recent', 16], ['tx_list_name', 12],
  ['analytics_cat_1y', 8], ['categories', 10],
  // 20% writes
  ['create_tx', 14], ['cc_payment', 3], ['update_tx', 3],
];
const MIX_TOTAL = MIX.reduce((a, [, w]) => a + w, 0);
function pickMixed() {
  let x = Math.random() * MIX_TOTAL;
  for (const [op, w] of MIX) { if ((x -= w) < 0) return op; }
  return MIX[0][0];
}

export default function (data) {
  const op = EP === 'mixed' ? pickMixed() : EP;
  // update_tx / cc_payment only exist for the heavy user's seeded rows
  const u = EP === 'mixed' && op !== 'update_tx' && op !== 'cc_payment' ? mixedCtx(data) : heavyCtx(data);
  // the step is the one in which the request was *issued*, so slow responses
  // are charged to the arrival rate that produced them
  const step = stepTag();
  const res = OPS[op](data, u);
  if (step === null) return;
  const ok = res.status >= 200 && res.status < 300;
  const tags = EP === 'mixed' ? { step, op } : { step };
  lat.add(res.timings.duration, tags);
  errs.add(!ok, tags);
  reqs.add(1, tags);
}

function pick3(v) { return v === undefined ? null : Math.round(v * 100) / 100; }

export function handleSummary(data) {
  const m = data.metrics;
  const steps = RATES.map((rate, i) => {
    const l = m[`ep_latency{step:${i}}`];
    const e = m[`ep_errors{step:${i}}`];
    const c = m[`ep_reqs{step:${i}}`];
    const count = c ? c.values.count : 0;
    const row = {
      step: i, target_rps: rate, count,
      achieved_rps: pick3(count / (STEP - WARM)),
      p50: l ? pick3(l.values.med) : null, p95: l ? pick3(l.values['p(95)']) : null,
      p99: l ? pick3(l.values['p(99)']) : null, avg: l ? pick3(l.values.avg) : null,
      max: l ? pick3(l.values.max) : null,
      error_rate: e ? pick3(e.values.rate * 100) / 100 : null,
    };
    if (EP === 'mixed') {
      row.ops = {};
      for (const op of MIXED_OPS) {
        const ol = m[`ep_latency{step:${i},op:${op}}`];
        const oe = m[`ep_errors{step:${i},op:${op}}`];
        if (ol) row.ops[op] = { count: ol.values.count, p50: pick3(ol.values.med), p95: pick3(ol.values['p(95)']), p99: pick3(ol.values['p(99)']), error_rate: oe ? oe.values.rate : null };
      }
    }
    row.sustainable = row.p95 !== null && row.p95 < 300 && row.error_rate < 0.01 && row.achieved_rps >= 0.95 * rate;
    return row;
  });
  // max_sustainable_rps: highest passing step (isolated noisy steps below it
  // are tolerated); first_fail_rps: first step that failed.
  let maxSustainable = 0;
  let firstFail = null;
  for (const s of steps) {
    if (s.sustainable) maxSustainable = s.target_rps;
    else if (firstFail === null) firstFail = s.target_rps;
  }
  const dropped = m.dropped_iterations ? m.dropped_iterations.values.count : 0;
  const out = { ep: EP, base: BASE, heavy_share: EP === 'mixed' ? HEAVY_SHARE : 1, warmup_seconds: WARMUP, step_seconds: STEP, warm_seconds: WARM, max_sustainable_rps: maxSustainable, first_fail_rps: firstFail, dropped_iterations: dropped, steps };
  const res = { stdout: JSON.stringify({ ep: EP, max_sustainable_rps: maxSustainable, steps: steps.map((s) => [s.target_rps, s.achieved_rps, s.p50, s.p95, s.p99, s.error_rate]) }) + '\n' };
  if (OUT) res[OUT] = JSON.stringify(out, null, 1);
  return res;
}
