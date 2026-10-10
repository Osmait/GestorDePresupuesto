# Observability

OpenTelemetry for the Go API and the Next.js frontend, plus a local stack to
look at it:

```
browser ──(Web Vitals beacon, sampled)──┐
                                        ▼
Next.js (instrumentation.ts, @vercel/otel) ──OTLP/HTTP──┐
   │ traceparent on fetch + SSE proxy                   │
   ▼                                                    ▼
Go API (otel middleware, otelsql, otelhttp) ──OTLP/gRPC──► OTel Collector ──► Jaeger (traces)
   └── /metrics (Prometheus, bearer token) ◄── scrape ── Prometheus ◄── scrape ──┘ (metrics)
                                                            ▲
                                                         Grafana (2 dashboards)
```

Everything is **off by default**: without `ENABLE_TRACING` / `METRICS_ENABLED`
(backend) and `OTEL_EXPORTER_OTLP_ENDPOINT` (frontend) nothing is created and
production behaves exactly as before.

## Quick start (local)

```bash
make obs-up          # Collector, Jaeger, Prometheus, Grafana
# Grafana   http://localhost:3001  (dashboards in folder "Gestor")
# Jaeger    http://localhost:16686
# Prometheus http://localhost:9090
make obs-down        # OBS_VOLUMES=1 make obs-down also deletes Prometheus data
```

Ports are bound to 127.0.0.1 and can be changed in `observability/.env`
(copy `.env.example`).

### Backend

```bash
cd BackEnd
ENABLE_TRACING=true \
METRICS_ENABLED=true METRICS_EXPORTER=otlp,prometheus METRICS_EXPORT_INTERVAL=10s \
METRICS_TOKEN=local-dev-metrics-token-change-me METRICS_PORT=9464 \
OTEL_SERVICE_NAME=gestor-backend \
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4317 OTEL_EXPORTER_OTLP_PROTOCOL=grpc \
OTEL_BATCH_TIMEOUT=1s \
make dev
```

- `METRICS_EXPORTER=otlp` pushes metrics through the collector (works
  everywhere). `prometheus` additionally serves `/metrics`, which Prometheus
  scrapes as job `gestor-backend-scrape` at `BACKEND_METRICS_TARGET`
  (`host.docker.internal:9464` by default). If a host firewall (ufw) blocks
  Docker → host traffic or the API listens on 127.0.0.1 only, that target shows
  as down; the OTLP path still feeds the dashboards. Pick the `job` in the
  dashboard variable.

### Frontend

```bash
cd FrontendNextjs/gestor
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 \
OTEL_SERVICE_NAME=gestor-frontend \
WEB_VITALS_SAMPLE_RATE=1 \
npm run dev        # or: npm run build && npm start
```

Log in, click around, then open Jaeger → service `gestor-frontend` → a trace
`GET /app` shows `render route` → `fetch GET …/transaction` →
`gestor-backend GET /transaction` → `SELECT transactions`.

## What is collected

### Backend (Go)

| Signal | Name | Labels / attributes |
| --- | --- | --- |
| span | `GET /transaction/:id` (route template; `GET unmatched` for 404) | `http.route`, `http.request.method`, `http.response.status_code`, `http.request.id`. No client IP, user agent, query string or user id. 5xx = error. Health checks and `/metrics` are not traced. |
| span | `SELECT transactions` (otelsql) | `db.query.text` with literals replaced by `?`, `db.query.summary`. Only created inside a trace. |
| span | `HTTP GET api.nasdaq.com` (otelhttp) | trace context is **not** sent to third parties |
| span | `worker transaction_scheduler`, `worker demo_cleanup` | new root trace per run; its DB queries are children |
| span | Gemini calls | gRPC spans from google's transport (automatic once the provider is global) |
| metric | `http_server_request_duration_seconds` | `http_route`, `http_request_method`, `http_response_status_class` |
| metric | `http_server_active_requests` | `http_route`, `http_request_method` |
| metric | `db_client_operation_duration_seconds` | `db_operation_name` (`sql.conn.query`, `sql.tx.commit`…), `db_query_summary`, `error_type` |
| metric | `db_sql_connection_open` (status idle / inuse), `db_sql_connection_max_open`, `db_sql_connection_wait_total`, `db_sql_connection_wait_duration_milliseconds_total` | pool saturation |
| metric | `http_client_request_duration_seconds` | `server_address`, `http_response_status_code` |
| metric | `worker_run_duration_seconds`, `worker_last_run_timestamp_seconds` | `worker`, `outcome` |
| metric | `go_*` runtime, `process_cpu_time_seconds_total` | |
| log | one access line per request: `method route status duration_ms bytes request_id trace_id` | `ACCESS_LOG` = all / errors / off |

Every response carries `X-Request-ID` (an incoming well-formed id is kept) and,
when the request was sampled, `X-Trace-ID` — paste it into Jaeger.
`observability.Logger.WithContext(ctx)` and `log.Info().Ctx(ctx)` add
`request_id`, `trace_id` and `span_id` to log lines.

### Frontend (Next.js)

- `instrumentation.ts` → `@vercel/otel` (works on Vercel and `next start`):
  Next's own spans (request, render, route handler, fetch) exported over
  OTLP/HTTP. Only when `OTEL_EXPORTER_OTLP_ENDPOINT` is set.
- W3C `traceparent` to the backend from the `/api/backend/*` proxy (fetch is
  propagated by `@vercel/otel`; the raw `node:http` SSE path injects it
  manually) and from server-component repositories.
- `Server-Timing: backend;desc="Go API";dur=…` on every proxied response
  (devtools → Network → Timing).
- Web Vitals (`LCP`, `INP`, `CLS`, `TTFB`, `FCP`) from a sampled fraction of
  page loads → `POST /api/vitals` → histograms `web_vitals_*` with a normalised
  `route` label. Off unless `WEB_VITALS_SAMPLE_RATE > 0`.

## Configuration reference

### Backend

| Variable | Default | Meaning |
| --- | --- | --- |
| `ENABLE_TRACING` | `false` | create and export spans |
| `METRICS_ENABLED` | `false` | create metrics (MeterProvider) |
| `METRICS_EXPORTER` | `prometheus` | `prometheus` (pull, `/metrics`) and/or `otlp` (push) |
| `METRICS_TOKEN` | – | bearer token for `/metrics` and the full `/health/detailed`; ≥16 chars |
| `METRICS_PORT` / `METRICS_HOST` | – / `SERVER_HOST` | serve `/metrics` on a separate (private) listener instead of the API port |
| `METRICS_EXPORT_INTERVAL` | `30s` | OTLP metric push interval |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://localhost:4317` | collector / vendor endpoint (legacy `OTEL_OTLP_ENDPOINT` still read) |
| `OTEL_EXPORTER_OTLP_PROTOCOL` | `grpc` | `grpc` or `http/protobuf` (`/v1/traces` and `/v1/metrics` are appended) |
| `OTEL_EXPORTER_OTLP_HEADERS` | – | `k=v,k2=v2`, URL-encoded values (e.g. `Authorization=Basic%20…`) |
| `OTEL_SERVICE_NAME` | `gestor-de-presupuesto` | `service.name` |
| `OTEL_ENVIRONMENT` | `$ENV` | `deployment.environment.name` |
| `OTEL_SAMPLING_RATE` | `1.0` | ratio for new root traces; parent-based, so traces started by the frontend follow its decision |
| `OTEL_BATCH_TIMEOUT` | `10s` | span batch flush interval |
| `ACCESS_LOG` | `all` in development, `errors` elsewhere | `errors` = 5xx and slow requests only |
| `ACCESS_LOG_SAMPLE_RATE` | `1.0` | fraction of fast non-5xx requests logged in `all` mode |
| `ACCESS_LOG_SLOW_THRESHOLD` | `1s` | slow request threshold |

In production `METRICS_ENABLED=true` with the prometheus exporter is rejected
at startup unless `METRICS_TOKEN` or `METRICS_PORT` is set: `/metrics` is never
public. `/health`, `/health/live` and `/health/ready` stay anonymous;
`/health/detailed` only returns statuses unless called with
`Authorization: Bearer $METRICS_TOKEN`.

### Frontend

| Variable | Default | Meaning |
| --- | --- | --- |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | – | enables OpenTelemetry (OTLP/HTTP, e.g. `http://localhost:4318`) |
| `OTEL_EXPORTER_OTLP_HEADERS` | – | vendor auth headers |
| `OTEL_SERVICE_NAME` | `gestor-frontend` | |
| `OTEL_TRACES_SAMPLER` / `OTEL_TRACES_SAMPLER_ARG` | always on | e.g. `parentbased_traceidratio` / `0.1` |
| `OTEL_METRICS_EXPORTER` | `otlp` | `none` disables metric export |
| `OTEL_METRIC_EXPORT_INTERVAL` | `30000` | ms |
| `WEB_VITALS_SAMPLE_RATE` | `0` (off) | fraction of page loads that report Web Vitals |

## Files

- `docker-compose.yml` – the stack (`make obs-up`)
- `otel-collector/config.yaml` – OTLP in; traces → Jaeger, metrics → Prometheus exporter; drops client-address attributes
- `prometheus/prometheus.yml` – scrape jobs (template; target/token from env)
- `grafana/provisioning` – Prometheus + Jaeger datasources, dashboard provider
- `grafana/dashboards/api-red.json` – *Gestor API — RED overview*: RPS, 5xx rate, p50/p95/p99 and p95 by route, slowest routes, in-flight, DB pool open/in-use/wait, Go runtime, Web Vitals
- `grafana/dashboards/db-dependencies.json` – *Gestor — DB & dependencies*: query p95 and rate by operation, DB time by operation, transactions, query errors, outgoing HTTP latency, worker runs
