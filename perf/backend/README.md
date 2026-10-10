# Backend performance harness

Reproducible load tests, profiling and DB analysis for the Go backend
(`BackEnd/`), comparing a branch against `main`. Nothing here changes
application behaviour: the only build-time addition is
`pprof/pprof_perf.go.txt`, injected with `go build -overlay` (see
`scripts/build.sh`) and inert unless `PPROF_ADDR` is set.

Requirements: Docker (images `postgres:17-alpine`, `grafana/k6`), Go, curl,
python3. Nothing is installed on the host; k6 runs in Docker with
`--network host`.

## Layout

| path | what |
|---|---|
| `seed/seed.sql` | deterministic seed (1 heavy user: 7 accounts incl. 2 credit cards, 30 categories, 12 budgets, 50k transactions over 3 years, recurring rules, card payments, investments, loans, certificates, plan items, notifications; 200 light users x 200 transactions). Valid for both schema versions (main = migrations <= 44, branch adds 45-51). Password for every user: `$PERF_USER_PASSWORD` |
| `scripts/pg-up.sh` | Postgres 17 container with `pg_stat_statements`, non-superuser owner role `perf` |
| `scripts/reset-db.sh` | drop/recreate the DB; `bypassrls` (default) or `norls` mode (see below) |
| `scripts/build.sh` | build a checkout's API with the pprof overlay |
| `scripts/run-backend.sh` / `stop-backend.sh` / `restart-backend.sh` | start/stop with the shared perf env (knobs documented in the script) |
| `scripts/prepare.sh` | one version end to end: container, fresh DB, build, start (migrates), seed, restart, smoke check |
| `scripts/smoke.sh` | hits every endpoint used by the scenarios, prints status/size/time |
| `scripts/compare.sh` | full comparison: per round reseed both versions, then `run-matrix.sh` |
| `scripts/run-matrix.sh` | interleaved k6 ladders (version order flips every round); detects and restarts wedged backends |
| `scripts/profile.sh` | pprof CPU/heap/allocs/mutex/block + runtime deltas + `pg_stat_activity` sampling + `pg_stat_statements` dump under a fixed-rate workload |
| `scripts/sse.sh` | SSE connection overhead (0/500/1000 open `/notifications` streams) |
| `scripts/aggregate.py` | k6 JSON -> markdown tables (medians, spread, branch-vs-main deltas) |
| `scripts/pgss-dump.sh` | `pg_stat_statements` top-by-total / top-by-mean / all as CSV |
| `scripts/deadlock.sh` | reproduce the pool deadlock (`k6/deadlock.js`), record health, parked goroutines, `idle in transaction` sessions; restarts a wedged backend |
| `seed/explain.sql` | `EXPLAIN (ANALYZE, BUFFERS)` of the top-12 statements with the heavy user's parameters |
| `seed/index-experiments.sql` | candidate indexes / rewrites, each inside a rolled-back transaction |
| `seed/rls-cost.sql` | SQL-level cost of the FORCE RLS policies (enforced vs bypassed) |
| `k6/ladder.js` | step-ladder open-model load test for one endpoint or the mixed workload |
| `k6/ladders.conf` | arrival-rate ladder per endpoint (+ optional VU cap) |
| `k6/sse.js`, `k6/deadlock.js` | SSE overhead; pool-deadlock reproduction |

Go micro-benchmarks live next to the code:

- `BackEnd/internal/domain/money/money_bench_test.go` — `money.Amount` vs `float64` (scalar and 100-row page JSON encode/decode, `Scan`, `Sum`).
- `BackEnd/internal/platform/server/middleware/rls_bench_test.go` — `RLSMiddleware` response buffering (in-memory) and, with `PERF_PG_DSN`, the full per-request RLS transaction cost vs a pool-only query, with lib/pq default vs `binary_parameters=yes`.
- `BackEnd/internal/platform/server/handler/transaction/transactionHandler_bench_test.go` — `GET /transaction` (20/100 rows) and `POST /transaction` through gin with an in-memory fake repo. The same file with float64 signatures was run against `main` for the comparison.

```sh
cd BackEnd
go test ./internal/domain/money ./internal/platform/server/handler/transaction \
  ./internal/platform/server/middleware -run '^$' -bench . -benchmem -count 6
PERF_PG_DSN='postgres://perf:$PERF_DB_PASSWORD@127.0.0.1:15441/perf?sslmode=disable' \
  go test ./internal/platform/server/middleware -run '^$' -bench RLS -benchmem -count 6
```

## Reproduce a branch-vs-main comparison

Credentials are never stored in the repo: export any values before running
the scripts (`scripts/env.sh` checks them).

```sh
export PERF_DB_PASSWORD=$(openssl rand -hex 12) PERF_USER_PASSWORD=$(openssl rand -hex 12)
export PERF_OUT=$PWD/perf-out           # binaries, logs, results
git worktree add --detach /tmp/perf-main main
perf/backend/scripts/compare.sh . /tmp/perf-main "1 2 3"       # ~2.5 h on 12 cores
python3 perf/backend/scripts/aggregate.py $PERF_OUT/results/k6 > tables.md

# profiling + pg_stat_statements under the mixed workload (200 req/s)
perf/backend/scripts/profile.sh $PERF_OUT/results branch http://127.0.0.1:18441 127.0.0.1:18451 perf-be-pg-15441 200
go tool pprof -top -nodecount=40 $PERF_OUT/results/profile/branch-mixed-200/cpu.pprof

# SSE overhead
perf/backend/scripts/sse.sh $PERF_OUT/results branch http://127.0.0.1:18441 127.0.0.1:18451 perf-be-pg-15441 $PERF_OUT/backend-branch.log

# pool deadlock reproduction (30 concurrent card payments)
docker run --rm -i --network host -v $PWD/perf/backend/k6:/scripts grafana/k6 run -e PASSWORD="$PERF_USER_PASSWORD" -e BASE=http://127.0.0.1:18441 -e VUS=30 /scripts/deadlock.js
git worktree remove /tmp/perf-main
docker rm -f perf-be-pg-15441 perf-be-pg-15442
```

## Methodology

- **Open model.** `ladder.js` uses `ramping-arrival-rate`: each step holds a
  constant arrival rate for `STEP` s (default 10; the published run used 8),
  after a discarded warm-up. Requests are tagged with the step in which they
  were *issued*, the first 2 s of each step are discarded. Per step: p50/p95/p99,
  achieved RPS, error rate.
- **Max sustainable RPS** = highest step with p95 < 300 ms, errors < 1 % and
  achieved >= 95 % of target. Ladders are coarse (see `ladders.conf`), so this
  is a lower bound with step resolution.
- **Moderate load** = the 50 req/s step (dashboard page loads and logins:
  10/s; mixed: 100/s).
- **Users.** Single-endpoint ladders use the heavy user (worst case: 50k
  transactions). The mixed workload uses the heavy user for 30 % of requests
  and 50 light users for the rest; 80 % reads / 20 % writes (create 14 %,
  card payment 3 %, update 3 %).
- **Noise.** Versions are interleaved per endpoint and the order flips each
  round; both databases are reseeded before every round (writes never leak
  across rounds; inside a round, write ladders run last). Host `nproc` and load
  average are logged per run in `runs.tsv`. Report medians and spread over
  >= 3 rounds.
- **RLS role.** On `main` many repositories run their queries on the pool,
  outside the request's RLS transaction, so with `FORCE ROW LEVEL SECURITY`
  and a role that does not bypass RLS, main returns *empty* results (it only
  works where the DB role bypasses RLS, e.g. a superuser). To compare equal
  work, the comparison uses role `perf` with `BYPASSRLS` for both versions.
  `reset-db.sh <container> norls` measures the branch with policies enforced.
- **Rate limiting** is disabled (`RATE_LIMIT_ENABLED=false`) for both
  versions; with it enabled 127.0.0.1 is whitelisted by default anyway.

## Known hazards when load testing this backend

- **Pool deadlock on feature-gated routes** (`/credit-cards`, `/investments`,
  `/loan`, `/certificate`): `RequireFeature` queries the pool *after*
  `RLSMiddleware` pinned a connection, so >= 25 concurrent requests wedge the
  process (POSTs permanently). `ladders.conf` caps `cc_payment` at 20 VUs and
  `run-matrix.sh` restarts wedged backends and keeps a goroutine dump.
- The exchange-rate service calls an external API (cached 1 h in process);
  `ladder.js` warms it in `setup()`.
