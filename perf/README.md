# Performance & observability baseline

Baseline taken on 2026-10-09 for PR #108 (security hardening) against `main`, plus the
tooling to re-measure after every improvement.

| what | where |
|---|---|
| Backend load tests (k6), profiling (pprof), DB analysis (pg_stat_statements, EXPLAIN), Go benchmarks | [`perf/backend/`](backend/README.md) · results: [`RESULTS-2026-10-09.md`](backend/RESULTS-2026-10-09.md) |
| Frontend bundles, Lighthouse, runtime waterfalls, render counts, proxy overhead | [`perf/frontend/`](frontend/README.md) · results: [`RESULTS-2026-10-09.md`](frontend/RESULTS-2026-10-09.md) |
| Local observability stack (OTel Collector, Jaeger, Prometheus, Grafana) | [`observability/`](../observability/README.md) — `make obs-up` |

## Baseline in one page

Data: 90k transactions (heavy user: 50k over 3 years). Medians of 3 interleaved rounds, 12-core host.

**Backend (PR #108 vs main)**

| | PR #108 | main |
|---|---|---|
| GET /account p50 (50 rps) | 19.3 ms | 18.9 ms |
| dashboard-summary p50 (month) | 22.6 ms | 21.9 ms |
| POST /transaction p50 | 4.2 ms | 3.3 ms |
| card payment p50 / p95 | 15.1 / 68.9 ms | 5.6 / 12.9 ms |
| mixed 80/20 max sustainable RPS (p95 < 300 ms) | 800 | 800 (stalled once) |
| 100 concurrent writers | before the pool fix: wedged; after: 1,184 ok, no hang | wedged |
| Go CPU per request (mixed 300 rps) | 0.61 ms | 0.54 ms |

Go is not the bottleneck (~0.18 core at 300 rps); Postgres is. Top DB time: account balances
recomputed from the full ledger (36%), all-time category expenses (20%), name-sorted pages
without an index (15%), non-sargable month filter (10.6%).

**Frontend (PR #108 vs main)**: −59 to −94 kB First Load JS per client page, −160 to −520 KB per
page load, fewer requests and no CORS preflights; LCP better on 7/9 pages. Costs: +2.3–3.6 ms per
proxied API call (session cookie decrypt/re-encrypt), +7.5 KB gz per HTML document (full i18n
catalog), dashboard TTFB +7 ms.

## After improvements (2026-10-10)

AFTER = PR #108 tip `0907d87` (all improvements). BEFORE = `c53c870` (baseline tooling commit, with the
pool fix). Same seed (90k transactions; heavy user 50k over 3 years), `BYPASSRLS` role, rate limits off.
**Host noise:** k6, Postgres (Docker) and the backends share one 12-core machine. During the runs
another project's Playwright suite and zig builds were also running: load average at run start had a
median of 5.1 (range 0.95–26.3), and IO pressure was 22–28 % "some" / 12–18 % "full". Docker runs on btrfs
on a SATA SSD, so every write path has ~50 ms fsync tails and occasional 1 s stalls in **both**
versions. Read p95 at low rates and all write tails are noisy, while p50 and capacity are robust.
Raw data (k6 JSON, pprof, pg_stat_statements, Lighthouse, videos) was kept outside the repo.

### Backend (host, 3 interleaved rounds, medians)

p50 / p95 in ms at 50 req/s (cc_payment: 10/s, mixed: 100/s). The "max RPS" column comes from the standard
`ladders.conf`. For AFTER that value is usually the top rung (`*`), so the extended ladder (2 rounds, up to
5,000 req/s, MAX_VUS 3,000) shows the real ceiling.

| endpoint | p50 before → after | p95 before → after | max RPS (std ladder) | max RPS (extended) | what saturates first (AFTER) |
|---|---|---|---|---|---|
| GET /account | 18.1 → **1.2** | 22.5 → 2.2 | 300 → 400\* | 250 → **~5,000** | fails at 7,500: host CPU 94 % (k6 1.6 cores, backend 2.1, Postgres 3.8) |
| GET /budget | 13.9 → **2.0** | 17.3 → 2.9 | 500 → 600\* | 500 → 4,000–5,000 | Postgres CPU (4.5 cores) |
| dashboard-summary (month) | 23.1 → **5.9** | 26.0 → 6.9 | 250 → 300\* | 200 → 1,000–1,500 | Postgres CPU (6.4–7 cores) |
| dashboard-summary (1 year) | 110 → **10.0** | 150 → 12.2 | 50 → 150\* | 50 → 600 | Postgres CPU (8 cores) |
| category-expenses (1 year) | 27.4 → **2.8** | 29.3 → 3.9 | 200 → 200\* | <250 → 2,000 | Postgres CPU (7.6 cores) |
| monthly-summary | 40.6 → **1.9** | 43.8 → 2.3 | 125 → 200\* | <250 → 2,000–3,000 | Postgres CPU |
| transactions by name | 2.0 → **0.6** | 2.5 → 0.8 | 2,000 → 2,000\* | 2,000 → ≥12,500 | in-process list cache; k6 itself uses 2.9 cores |
| POST /auth/refresh | 2.3 → 2.5 | 2.9 → 5.1 (2.9–51.6) | 450 → 800 | – | noise (1 s stalls in both) |
| POST /transaction | 4.7 → 4.2 | 10.7 → 6.2 | 450 → 450 | – | WAL fsync + row locks (see regressions) |
| card payment | 17.4 → **6.9** | 61.7 → 56.7 | 75 → 75\* | – | fsync tail ~55 ms in both |
| mixed 80/20 (30 % heavy user) | 3.0 → **1.6** | 50.6 → 26.7 | 800 → 800\* | 500 → **1,000** | row-lock waits on the heavy user's rows (`tuple`/`transactionid` 53 %, WALWrite 21 %); CPU < 2.3 cores |
| mixed multi-user (95 % of 200 light users) | @500: 2.1 → 1.6 | @500: 13.2 → 27.7 (5–50) | – | 500–1,000 → 1,000–1,500 | same lock waits (payments/updates still go to the heavy user) |

Under the mixed load at 300 req/s (pprof window of 30 s):

| per request | before | after |
|---|---:|---:|
| Go CPU | 0.64 ms | **0.53 ms** |
| heap allocations | 1,015 / 52.8 KB | **595 / 41.4 KB** |
| GCs / 30 s | 34 | 11 |
| Postgres exec time (whole run) | 106.6 s | **35.6 s (−67 %)** |

Top DB time share. BEFORE: balances `SUM` 30 %, all-time category expenses 16 %, name-sorted page 14 %,
account `FOR UPDATE` 10 %, budget spent 10 %. AFTER: account `FOR NO KEY UPDATE` 38 % (card payments
waiting for each other on one account, inflated by one 1.3 s fsync stall), `INSERT transactions` 14 %,
`COUNT(*)` per list 9 %, monthly-rollup upsert trigger 8 %, category totals 5 %.
`deadlock.sh` with 100 VUs on AFTER: never wedged, and 0 goroutines were parked after each run. Results: payments 1,299 ok / 5 × 503
(request timeout; 100 writers serialize on 2 cards), GET 135,759 ok, dashboard-summary 6,312 ok.

### Resource-limited results (Docker, cgroup limits)

The backend image was built from each worktree's `BackEnd/dockerfile`. Postgres 17 ran with the same perf settings, and
k6 ran on the host (`--network host`, outside the limits). Ladders were extended until failure, with 2 interleaved
rounds and medians.
**small**: backend `--cpus=1 --memory=512m`, `DB_MAX_OPEN_CONNS=10`; Postgres `--cpus=1 --memory=1g`,
`shared_buffers=128MB`, `max_connections=50`. **tiny**: backend `--cpus=0.5 --memory=256m`, pool 5;
Postgres `--cpus=0.5 --memory=512m`, `shared_buffers=64MB`, `max_connections=30`.
Go 1.25 sets **GOMAXPROCS=2 in both profiles** (it has a floor of 2 below 2 CPUs; verified with `schedtrace` and
`/debug/runtime`), so the 0.5-CPU backend is CFS-throttled for 4–15 s per run.

| scenario | small: max RPS before → after | small: p50/p95 ms before → after | tiny: max RPS before → after | tiny: p50/p95 ms before → after |
|---|---|---|---|---|
| mixed (heavy user 30 %) | 50–100 → **600** | @100: 44/752 → 2.5/185 | 50 → **300–400** | @100: 287/1,462 → 1.4/11 |
| mixed multi-user | 400 → **600–800** | @100: 2.8/171 → 1.5/338¹ | 200 → **400** | @100: 1.5/31 → 1.2/35 |
| GET /account | 0–50 → ≥2,000\* | @50: 179/2,512 → 1.3/1.8 | 25 → ≥1,000\* | @50: 4,460/5,001 → 1.1/1.5 |
| dashboard-summary | 25 → **50** | @50: 3,477/5,001 → 9.9/12 | 10 → **50** | @50: 5,000/5,001 → 8.4/76 |
| POST /transaction | 300 → 200–300 | @50: 4.1/5.9 → 5.5/59 | 150 → 100–150 | @50: 4.7/11 → 4.3/35 |
| card payment | 30–75 → 50–75 | @10: 21/975 → 5.9/107 | 20–40 → **75** | @10: 14/78 → 5.8/245¹ |

¹ The p95 at these points comes from one or two fsync stalls per run (spread 6–671 ms). The p50 values and the ceilings are stable.
What saturates first: BEFORE always hits **Postgres CPU** (cgroup-throttled for 600–780 s per read run). AFTER hits Postgres CPU
on dashboard-summary (about 10 ms of Postgres CPU per call, so roughly 100 req/s per core) and on mixed loads above 600 req/s. WAL fsync and
row-lock waits come next. The backend never used more than 47 % of its CPU limit, and there were no OOM kills and no errors below
the ceilings. **Memory:** the AFTER backend reached its memory limit in both profiles (512 MB: `memory.events max`
= 12; 256 MB: 54). BEFORE peaked at 225 / 213 MB. See regression 1.

### Frontend (production builds, same host)

| route | First Load JS before → after (kB) |
|---|---|
| / · /app · /app/transactions | 176 → 165 · 293 → **231** · 354 → 340 |
| /app/accounts · /app/accounts/[id] | 263 → 253 · 322 → **195** |
| /app/analysis · /app/investments · /app/certificates | 278 → 264 · 402 → **221** · 429 → **223** |

| page (Lighthouse mobile, 3 runs) | score | LCP ms | KB | requests | runtime cold load: requests / `/api/auth/session` / data visible ms |
|---|---|---|---|---|---|
| dashboard | 71 → 78 | 4,377 → 3,842 | 758 → 616 | 70 → 57 | 68 → 55 / 2 → 0 / 526 → 403 |
| transactions | 78 → 81 | 4,400 → 3,937 | 818 → 581 | 78 → 60 | 77 → 59 / 2 → 0 / 440 → 375 |
| accounts/[id] | 61 → 59² | 6,771 → 5,679 | 815 → 645 | 74 → 66 | 72 → 64 / 2 → 0 / 478 → 321 |
| analysis | 61 → 64 | 4,086 → 3,638 | 812 → 695 | 83 → 71 | 81 → 69 / 2 → 0 / 404 → 283 (last data) |
| investments | 59 → 66 | 6,732 → 5,430 | 778 → 620 | 70 → 60 | 68 → 58 / 2 → 0 / 2,434 → 2,278³ |

² TBT is bimodal (598 → 858 ms), as described in the baseline, while LCP improved. ³ Both versions wait about 2.2 s for the investments data.
Typing "Gasto 12" (8 keys) in the transactions search went from **74,105 → 1,348** component renders and 59 → 15 commits, and from
8 API + 8 RSC → **1 API + 0 RSC** requests. Navigating from the dashboard to transactions went from 6 API + 3 RSC → 1 API + 1 RSC.
Proxy (n = 200, sequential): AFTER adds +1.8–3.4 ms p50 per call with **no `Set-Cookie`**. BEFORE added +3.5–5.5 ms in this
noisier session (+2.3–3.6 in the baseline) and 1,231 B of `Set-Cookie`. For a burst of 8, wall p50 is 15.3–16.5 ms in AFTER vs 6.0 direct,
and 28.8–39.6 ms in BEFORE vs 12.3–17.7 direct.

### Regressions and what remains

1. **Transaction-list cache memory (fixed after this run).** Invalidation bumped a generation counter and left the
   orphaned entries in memory until their TTL (5 min) and the janitor run (10 min), so the heap grew with write rate × page
   size: after a 1,000 req/s multi-user ladder, 181 MB stayed in use while idle, 55 MB of it cached transaction pages.
   This is what hit the 256/512 MB container limits. Fix: `internal/platform/cache/cache.go` now indexes each group's
   stored keys and deletes the old generation's entries on the bump (`TestDeleteByPrefix_FreesOldEntries`).
2. **Write contention on one user.** Concurrent inserts into the same (user, month, category) wait on the
   rollup row until COMMIT (`transactionid` waits behind `WALWrite`/`WalSync`). Single-user `POST /transaction` sustained
   at 300 req/s had a p95 of 0.9–3 s (BEFORE: 0.05–1.6 s; fsync-bound on this host in both). The limited profiles show it at
   low rates too (small: p95 @50 is 52–67 ms vs 6 ms). Card payments also serialize on the account row. Options: stripe the
   rollup like `account_balances`, or apply the rollup asynchronously.
3. **SSE after an expired access token (fixed after this run).** The stream bypassed the refresh path, so a full reload
   with an expired token got a 401 on `/api/backend/notifications` and the stream reconnected about 5 s later. BEFORE
   refreshed first and got no 401. Fix: `lib/server/backend-proxy.ts` refreshes an expired token for streams through the
   same deduped `ensureFreshToken` (no Set-Cookie on the stream; it sets `x-session-refreshed` and the client re-syncs its
   session), and `useNotification` reconnects at once after a recovered 401.
4. Remaining from the lists: `COUNT(*)` on every list (9 % of DB time), dashboard-summary Postgres CPU
   (the 1-vCPU ceiling is about 50–100 req/s), the proxy burst gap, the `glow-pulse` animation, and the hard-coded Spanish strings in
   `NotificationCenter` (pre-existing).

## Ranked improvements (impact / effort)

Status as of 2026-10-10 (PR #108 tip `0907d87`, measured below).

| # | improvement | expected impact | effort | status |
|---|---|---|---|---|
| 1 | Replace the 7.1 MB logo PNG and make sure `sharp` ships in the deploy image | −6.9 MB per page if sharp is missing | XS | logo done (7 KB WebP); deploy image not checked |
| 2 | Maintain account balances on write (or covering index first) | −36% DB time; /account 20 → ~2 ms (index alone: 21.8 → 12.3 ms) | M (S) | done: /account p50 18.1 → 1.2 ms |
| 3 | Card payments: `FOR NO KEY UPDATE` + O(1) funds check | payment p50 15 → ~6 ms, no 47–62 ms lock waits | S | done: p50 17.4 → 6.9 ms; payments still serialize per account (see below) |
| 4 | Sargable month filter for budget spent | 12.5 → 1.8 ms | S | done: /budget p50 13.9 → 2.0 ms |
| 5 | Index `(user_id, type_transation, transaction_name, id)` | name-sorted pages 14.9 → 0.9 ms | S | done: 2.0 → 0.6 ms (plus list cache) |
| 6 | Transactions UI: debounce search, memoized filters, `history.replaceState`, memoized rows + shared dialogs | 8 API + 8 RSC → 1 API per search; ~74k → <5k renders | S–M | done: 1 API, 0 RSC, 1,348 renders |
| 7 | Pre-aggregate all-time analytics | 29–40 ms → <2 ms | M | done: 27–110 → 2–10 ms |
| 8 | Proxy: decode the session cookie once, re-encode only near refresh | −0.55 ms CPU and −1.2 KB per API call; closes most of the burst gap | M | done: no `Set-Cookie`; burst gap halved, not closed |
| 9 | gzip JSON + bound `notifications/history` | 87 KB → ~10 KB per load, stops unbounded growth | S | done: API KB per load 39–82 → 3–11 |
| 10 | `binary_parameters=yes` or pgx | 1 round trip instead of 2 per query; −20% per request | S | done (`binary_parameters=yes`) |
| 11 | Dashboard payload: drop unused `transactions` prop, lazy tabs, client-only i18n namespaces | dashboard doc 305 → ~190 KB raw | S–M | done; document size not re-measured |
| 12 | One chart library, dedupe date-fns/d3/lodash, lazy `driver.js` | −40–80 KB gz on chart routes | L | done (Nivo only): −127 to −206 kB First Load JS on chart routes |

Full lists with file:line references are in the two results files.

## Re-measuring

1. Backend: `perf/backend/scripts/compare.sh` (branch vs main) or `prepare.sh` + `run-matrix.sh` for one version; pool regression check: `scripts/deadlock.sh`.
2. Frontend: see `perf/frontend/README.md` (production builds, Lighthouse with simulated throttling, Playwright runtime probes).
3. With the observability stack up, compare p95 by route and DB time per operation in Grafana before/after.
