# Frontend performance tooling

Reproducible measurements for the Next.js app in `FrontendNextjs/gestor`:
bundles, Lighthouse, runtime behaviour (requests, waterfalls, hydration, long
tasks, memory, React commits), the `/api/backend/*` proxy overhead and the
server side (TTFB, RSC payloads, `next start` CPU/RSS under light load).

Nothing here changes app behaviour. The only app-level change is an opt-in
bundle analyzer in `next.config.js` (`ANALYZE=true`; `@next/bundle-analyzer` is a
devDependency and is only `require`d when enabled).

All scripts are plain Node (>= 20) ESM and take explicit URLs/ports, so two
versions (e.g. this branch and `main`) can be compared side by side.
Playwright comes from `e2e-test/node_modules` (`cd e2e-test && npm ci`); the
Chromium binary defaults to `~/.cache/ms-playwright/chromium-1243/chrome-linux64/chrome`
(override with `CHROME_PATH`). Results go to `--out <dir>` (default `./perf-results`).

## 0. Environment

```bash
# Credentials are not stored in the repo: any values work
export PERF_DB_PASSWORD=$(openssl rand -hex 12) PERF_USER_PASSWORD=$(openssl rand -hex 12)

# Postgres + backend (branch) — any free ports
docker run -d --name perf-fe-pg -p 127.0.0.1:15461:5432 -e POSTGRES_USER=perf \
  -e POSTGRES_PASSWORD="$PERF_DB_PASSWORD" -e POSTGRES_DB=perf_branch postgres:15-alpine
cd BackEnd && go build -o /tmp/backend . && \
  ENV=test DB_TYPE=postgres DB_HOST=127.0.0.1 DB_PORT=15461 DB_NAME=perf_branch DB_USER=perf \
  DB_PASSWORD="$PERF_DB_PASSWORD" DB_SSL_MODE=disable JWT_SECRET=perf-jwt-secret-must-be-at-least-32-characters-long \
  SERVER_HOST=127.0.0.1 SERVER_PORT=18461 GEMINI_API_KEY= ADMIN_ENABLED=false RATE_LIMIT_ENABLED=false \
  /tmp/backend &
# For a `main` baseline: `git worktree add ../perf-main main`, second DB (perf_main),
# run its backend with cwd = its BackEnd dir (main reads migrations from disk).

# Heavy user: 4 accounts, 12 categories, 8 budgets, investments, 3000 transactions over 12 months
node perf/frontend/seed.mjs http://127.0.0.1:18461 heavy@perf.test 3000
```

**sharp**: `npm ci` with npm 11 skipped `sharp` (optional dependency of `next`) in
this setup, and then `/_next/image` silently falls back to the original file —
the sidebar logo is a 7.1 MB PNG. If `node -e "require('sharp')"` fails in
`FrontendNextjs/gestor`, run `npm i --no-save --ignore-scripts sharp@0.34.5`
before measuring, then clear `.next/cache/images` and restart `next start`.

## 1. Bundles

```bash
# production build + analyzer reports + per-chunk raw/gzip sizes
PERF_OUT=$OUT perf/frontend/build.sh FrontendNextjs/gestor branch analyze
# (main needs NEXT_PUBLIC_BACKEND_URL at build time and a temporary copy of the
#  analyzer wrapper in its next.config.js)
node perf/frontend/analyze-bundles.mjs $OUT/bundles branch main   # -> bundle-summary.md/json
```

## 2. Start the servers

```bash
perf/frontend/start-frontend.sh FrontendNextjs/gestor 13461 http://127.0.0.1:18461 $OUT/fe-branch.log
node perf/frontend/login.mjs --base http://127.0.0.1:13461 --out $OUT/auth-branch.json   # + .cookie.txt
perf/frontend/stop-port.sh 13461        # stop by PID of the listener (never pkill by name)
```

## 3. Lighthouse (simulated throttling, mobile + desktop, interleaved)

```bash
node perf/frontend/lighthouse.mjs --out $OUT --runs 3 \
  --version branch=http://127.0.0.1:13461,$OUT/auth-branch.cookie.txt \
  --version main=http://127.0.0.1:13462,$OUT/auth-main.cookie.txt \
  --account-branch <accountId> --account-main <accountId>
```

Authenticated pages get the session cookie through `--extra-headers`. The app
keeps an SSE stream open (`/notifications`), so the network never goes quiet;
`--max-wait-for-load` is 25 s and TBT/TTI include the never-ending
`glow-pulse` sidebar animation — read TBT with care (see RESULTS).

## 4. Runtime (Playwright + CDP)

```bash
node perf/frontend/runtime.mjs --out $OUT --runs 3 \
  --version branch=http://127.0.0.1:13461,$OUT/auth-branch.json,http://127.0.0.1:18461 \
  --version main=http://127.0.0.1:13462,$OUT/auth-main.json,http://127.0.0.1:18462 \
  --account-branch <id> --account-main <id>
```

Writes `runtime/cold-loads.csv` (+ medians), `runtime/client-nav.csv` (+ medians)
and `runtime/waterfalls.json`. "Data visible" = first frame where the page's
marker (text/selector in `lib/common.mjs#pages`) is in the DOM.
`lib/inpage.js` installs a minimal React DevTools hook (production React calls
it on every commit) to timestamp hydration and count commits/renders.

Extra probes:

```bash
node perf/frontend/animations.mjs --base ... --storage ... --paths /app,/app/transactions
node perf/frontend/commit-loop.mjs --base ... --storage ... --path /app --seconds 10
node perf/frontend/interactions.mjs --base ... --storage ... --backend ... --label branch --out $OUT
```

For real component names and self times in `interactions.mjs`, run it against a
profiling build in a scratch copy: `npx next build --profile` (React profiling
build + unmangled names), not against the build you ship.

## 5. Proxy overhead

```bash
node perf/frontend/proxy-bench.mjs --out $OUT --n 200 \
  --frontend http://127.0.0.1:13461 --backend http://127.0.0.1:18461 --cookie-file $OUT/auth-branch.cookie.txt \
  --main-frontend http://127.0.0.1:13462 --main-backend http://127.0.0.1:18462 --main-cookie-file $OUT/auth-main.cookie.txt \
  --gestor FrontendNextjs/gestor
```

Interleaved direct vs proxied calls (sequential and 8-wide bursts), the
`/api/auth/session` endpoint, the "main-style" call (`getSession()` + direct
call) and the in-process JWE decode/encode cost of the session cookie.

## 6. Server

```bash
node perf/frontend/server-bench.mjs --out $OUT --n 30 \
  --version branch=http://127.0.0.1:13461,$OUT/auth-branch.cookie.txt,<accountId> ...
# light load + CPU/RSS of next-server
node perf/frontend/sample-proc.mjs --port 13461 --seconds 75 --out $OUT/server/proc-branch.csv &
docker run --rm -i --network host -v $PWD/perf/frontend/k6:/scripts grafana/k6 run \
  -e BASE=http://127.0.0.1:13461 -e COOKIE="$(cat $OUT/auth-branch.cookie.txt)" -e MODE=proxy \
  -e VUS=5 -e DURATION=60s /scripts/pages.js
```

`MODE=direct` (+ `BACKEND`, `TOKEN`) models `main`, whose browser calls the
backend directly and hits `/api/auth/session` before every call.

## Files

| script | what |
|---|---|
| `build.sh` | production build (+ `analyze`), chunk sizes CSV, manifests |
| `analyze-bundles.mjs` | package/route breakdown from analyzer reports |
| `seed.mjs` | heavy user through the API |
| `start-frontend.sh`, `stop-port.sh`, `login.mjs` | servers and auth state |
| `lighthouse.mjs` | Lighthouse matrix, medians |
| `runtime.mjs` | cold loads + client navigation (Playwright/CDP) |
| `animations.mjs`, `commit-loop.mjs`, `interactions.mjs` | idle CPU / running animations, commit storms, render hotspots |
| `proxy-bench.mjs` | proxy vs direct latency, session endpoint, JWE cost |
| `server-bench.mjs`, `k6/pages.js`, `sample-proc.mjs` | TTFB, RSC size, light load, CPU/RSS |
| `html-breakdown.py` | flight payload vs markup in a server-rendered page |
