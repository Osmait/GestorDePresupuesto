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

## Ranked improvements (impact / effort)

| # | improvement | expected impact | effort |
|---|---|---|---|
| 1 | Replace the 7.1 MB logo PNG and make sure `sharp` ships in the deploy image | −6.9 MB per page if sharp is missing | XS |
| 2 | Maintain account balances on write (or covering index first) | −36% DB time; /account 20 → ~2 ms (index alone: 21.8 → 12.3 ms) | M (S) |
| 3 | Card payments: `FOR NO KEY UPDATE` + O(1) funds check | payment p50 15 → ~6 ms, no 47–62 ms lock waits | S |
| 4 | Sargable month filter for budget spent | 12.5 → 1.8 ms | S |
| 5 | Index `(user_id, type_transation, transaction_name, id)` | name-sorted pages 14.9 → 0.9 ms | S |
| 6 | Transactions UI: debounce search, memoized filters, `history.replaceState`, memoized rows + shared dialogs | 8 API + 8 RSC → 1 API per search; ~74k → <5k renders | S–M |
| 7 | Pre-aggregate all-time analytics | 29–40 ms → <2 ms | M |
| 8 | Proxy: decode the session cookie once, re-encode only near refresh | −0.55 ms CPU and −1.2 KB per API call; closes most of the burst gap | M |
| 9 | gzip JSON + bound `notifications/history` | 87 KB → ~10 KB per load, stops unbounded growth | S |
| 10 | `binary_parameters=yes` or pgx | 1 round trip instead of 2 per query; −20% per request | S |
| 11 | Dashboard payload: drop unused `transactions` prop, lazy tabs, client-only i18n namespaces | dashboard doc 305 → ~190 KB raw | S–M |
| 12 | One chart library, dedupe date-fns/d3/lodash, lazy `driver.js` | −40–80 KB gz on chart routes | L |

Full lists with file:line references are in the two results files.

## Re-measuring

1. Backend: `perf/backend/scripts/compare.sh` (branch vs main) or `prepare.sh` + `run-matrix.sh` for one version; pool regression check: `scripts/deadlock.sh`.
2. Frontend: see `perf/frontend/README.md` (production builds, Lighthouse with simulated throttling, Playwright runtime probes).
3. With the observability stack up, compare p95 by route and DB time per operation in Grafana before/after.
