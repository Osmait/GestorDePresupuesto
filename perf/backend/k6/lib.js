// Shared helpers for the perf k6 scripts.
import http from 'k6/http';

export const BASE = __ENV.BASE || 'http://127.0.0.1:18441';
// Seeded users' password: pass -e PASSWORD=$PERF_USER_PASSWORD (see scripts/env.sh).
export const PASSWORD = __ENV.PASSWORD;
if (!PASSWORD) throw new Error('PASSWORD env var is required (-e PASSWORD=$PERF_USER_PASSWORD)');

// Seed ids are deterministic (see perf/backend/seed/seed.sql): prefix + zero
// padded number, 27 chars total.
export function pid(prefix, n) {
  const s = String(n);
  return prefix + '0'.repeat(27 - prefix.length - s.length) + s;
}
export const HEAVY = {
  email: 'heavy@perf.test',
  user: pid('pu', 0),
  dopAccounts: [1, 2, 3].map((k) => pid('pa', k)),
  usdAccounts: [4, 5].map((k) => pid('pa', k)),
  cards: [6, 7].map((k) => pid('pa', k)),
  expenseCategories: Array.from({ length: 27 }, (_, i) => pid('pc', 4 + i)),
};
export function light(u) {
  return {
    email: `light${String(u).padStart(3, '0')}@perf.test`,
    account: pid('pa', u * 10 + 1),
    categories: [2, 3, 4, 5, 6, 7, 8].map((c) => pid('pc', u * 100 + c)),
  };
}

export function login(email, tags) {
  const res = http.post(`${BASE}/auth/login`, JSON.stringify({ email, password: PASSWORD }), {
    headers: { 'Content-Type': 'application/json' },
    tags: tags || { phase: 'setup' },
  });
  if (res.status !== 200) throw new Error(`login ${email} -> ${res.status} ${res.body}`);
  return res.json();
}

export function auth(token, extra) {
  return { headers: Object.assign({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, extra || {}) };
}

function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const now = new Date();
export const MONTH_FROM = ymd(new Date(now.getFullYear(), now.getMonth(), 1));
export const MONTH_TO = ymd(new Date(now.getFullYear(), now.getMonth() + 1, 0));
export const YEAR_FROM = ymd(new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()));
export const TODAY = ymd(now);

export function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
