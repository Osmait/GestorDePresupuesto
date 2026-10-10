package telemetry

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/metric"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/trace"

	"github.com/osmait/gestorDePresupuesto/internal/config"
)

func baseConfig() *config.Config {
	return &config.Config{
		OpenTelemetry: config.OpenTelemetryConfig{
			ServiceName:    "test-svc",
			ServiceVersion: "0.0.1",
			Environment:    "test",
			SamplingRate:   1,
			OTLPEndpoint:   "http://127.0.0.1:1", // never reached in these tests
			OTLPProtocol:   "grpc",
		},
	}
}

func TestSetupDisabledByDefault(t *testing.T) {
	tel, err := Setup(context.Background(), baseConfig())
	if err != nil {
		t.Fatal(err)
	}
	if tel.Enabled() || tel.TracingEnabled() || tel.MetricsEnabled() {
		t.Fatal("telemetry must be off unless ENABLE_TRACING / METRICS_ENABLED are set")
	}
	if tel.MetricsHandler() != nil {
		t.Fatal("no /metrics handler when metrics are disabled")
	}
	_, span := tel.TracerProvider().Tracer("x").Start(context.Background(), "s")
	if span.SpanContext().IsValid() {
		t.Fatal("disabled telemetry must hand out no-op spans")
	}
	if err := tel.Shutdown(context.Background()); err != nil {
		t.Fatal(err)
	}
}

func TestSetupPrometheusMetrics(t *testing.T) {
	cfg := baseConfig()
	cfg.Metrics = config.MetricsConfig{Enabled: true, Exporters: []string{"prometheus"}}
	tel, err := Setup(context.Background(), cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = tel.Shutdown(context.Background()) }()

	if !tel.MetricsEnabled() || tel.TracingEnabled() {
		t.Fatalf("want metrics only, got tracing=%v metrics=%v", tel.TracingEnabled(), tel.MetricsEnabled())
	}
	h, _ := tel.MeterProvider().Meter("t").Float64Histogram("http.server.request.duration", metric.WithUnit("s"))
	h.Record(context.Background(), 0.042, metric.WithAttributes(attribute.String("http.route", "/account")))

	rec := httptest.NewRecorder()
	tel.MetricsHandler().ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/metrics", nil))
	body, _ := io.ReadAll(rec.Body)
	for _, want := range []string{
		`http_server_request_duration_seconds_bucket{http_route="/account"`,
		"go_goroutine_count",             // runtime metrics
		"process_cpu_seconds_total",      // process collector
		"process_cpu_time_seconds_total", // runtime/metrics CPU (also over OTLP)
		`service_name="test-svc"`,        // target_info
	} {
		if !strings.Contains(string(body), want) {
			t.Errorf("metrics output missing %q", want)
		}
	}
}

func TestSamplerIsParentBased(t *testing.T) {
	parent := trace.NewSpanContext(trace.SpanContextConfig{
		TraceID:    trace.TraceID{1},
		SpanID:     trace.SpanID{1},
		TraceFlags: trace.FlagsSampled,
		Remote:     true,
	})
	ctx := trace.ContextWithRemoteSpanContext(context.Background(), parent)
	// Even with a 0 ratio, a sampled upstream (the Next.js proxy) is continued.
	res := Sampler(0).ShouldSample(sdktrace.SamplingParameters{ParentContext: ctx, TraceID: parent.TraceID(), Name: "x"})
	if res.Decision != sdktrace.RecordAndSample {
		t.Fatalf("sampled parent must be continued, got %v", res.Decision)
	}
	res = Sampler(0).ShouldSample(sdktrace.SamplingParameters{ParentContext: context.Background(), TraceID: trace.TraceID{2}, Name: "x"})
	if res.Decision != sdktrace.Drop {
		t.Fatalf("rate 0 root must be dropped, got %v", res.Decision)
	}
}

func TestSignalURL(t *testing.T) {
	cases := map[string]string{
		"http://collector:4318":                  "http://collector:4318/v1/traces",
		"https://otlp-gateway.grafana.net/otlp":  "https://otlp-gateway.grafana.net/otlp/v1/traces",
		"https://otlp-gateway.grafana.net/otlp/": "https://otlp-gateway.grafana.net/otlp/v1/traces",
		"https://api.honeycomb.io/v1/traces":     "https://api.honeycomb.io/v1/traces",
	}
	for in, want := range cases {
		got, err := signalURL(in, "/v1/traces")
		if err != nil || got != want {
			t.Errorf("signalURL(%q) = %q, %v; want %q", in, got, err, want)
		}
	}
}

func TestBearerAuth(t *testing.T) {
	ok := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) })
	const token = "0123456789abcdef-metrics"
	cases := []struct {
		name, header, token string
		want                int
	}{
		{"missing header", "", token, http.StatusUnauthorized},
		{"wrong token", "Bearer nope", token, http.StatusUnauthorized},
		{"basic scheme", "Basic " + token, token, http.StatusUnauthorized},
		{"valid", "Bearer " + token, token, http.StatusOK},
		{"case-insensitive scheme", "bearer " + token, token, http.StatusOK},
		{"empty configured token fails closed", "Bearer ", "", http.StatusUnauthorized},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodGet, "/metrics", nil)
			if tc.header != "" {
				req.Header.Set("Authorization", tc.header)
			}
			rec := httptest.NewRecorder()
			BearerAuth(tc.token, ok).ServeHTTP(rec, req)
			if rec.Code != tc.want {
				t.Fatalf("got %d want %d", rec.Code, tc.want)
			}
		})
	}
}

func TestSanitizeSQL(t *testing.T) {
	cases := map[string]string{
		"SELECT * FROM users WHERE email = 'a@b.com' AND id = 42":       "SELECT * FROM users WHERE email = ? AND id = ?",
		"SELECT id\n\t FROM accounts  WHERE user_id = $1 LIMIT 10":      "SELECT id FROM accounts WHERE user_id = $1 LIMIT ?",
		"UPDATE t SET name = 'O''Brien' -- comment\nWHERE id=$2":        "UPDATE t SET name = ? WHERE id=$2",
		"SELECT set_config('app.current_user_id', $1, true)":            "SELECT set_config(?, $1, true)",
		"SELECT col1, t2.col_2 FROM t2 /* hint */ WHERE amount > 10.50": "SELECT col1, t2.col_2 FROM t2 WHERE amount > ?",
	}
	for in, want := range cases {
		if got := SanitizeSQL(in); got != want {
			t.Errorf("SanitizeSQL(%q)\n got  %q\n want %q", in, got, want)
		}
	}
	if got := SanitizeSQL(strings.Repeat("SELECT 1 ", 1000)); len(got) > maxStatementLen {
		t.Fatalf("statement not truncated: %d", len(got))
	}
}

func TestQuerySummary(t *testing.T) {
	cases := map[string]string{
		"SELECT a FROM transactions t JOIN accounts a ON a.id = t.account_id": "SELECT transactions",
		"select * from \"Accounts\" where id=$1":                              "SELECT accounts",
		"INSERT INTO budgets (id) VALUES ($1)":                                "INSERT budgets",
		"UPDATE ONLY users SET x=$1":                                          "UPDATE users",
		"DELETE FROM refresh_tokens WHERE expires_at < now()":                 "DELETE refresh_tokens",
		"WITH x AS (SELECT * FROM categories) SELECT * FROM x":                "WITH categories",
		"SELECT set_config('app.current_user_id', $1, true)":                  "SELECT",
		"SELECT * FROM (SELECT 1) sub":                                        "SELECT",
		"BEGIN":                                                               "BEGIN",
		"  ":                                                                  "UNKNOWN",
		"SELECT 'FROM secret' FROM ledger":                                    "SELECT ledger",
	}
	for in, want := range cases {
		if got := QuerySummary(in); got != want {
			t.Errorf("QuerySummary(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestOpenDBDisabledIsPlainDriver(t *testing.T) {
	db, err := OpenDB(Disabled(), "postgres", "postgres://u:p@127.0.0.1:1/x?sslmode=disable")
	if err != nil {
		t.Fatal(err)
	}
	defer func() { _ = db.Close() }()
	if got := strings.ToLower(strings.TrimPrefix(typeName(db.Driver()), "*")); !strings.Contains(got, "pq.") {
		t.Fatalf("disabled telemetry must use the plain driver, got %s", got)
	}
}
