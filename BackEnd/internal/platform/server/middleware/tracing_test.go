package middleware

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/propagation"
	sdkmetric "go.opentelemetry.io/otel/sdk/metric"
	"go.opentelemetry.io/otel/sdk/metric/metricdata"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/sdk/trace/tracetest"

	"github.com/osmait/gestorDePresupuesto/internal/config"
	"github.com/osmait/gestorDePresupuesto/internal/platform/observability"
)

type telemetryHarness struct {
	engine *gin.Engine
	spans  *tracetest.SpanRecorder
	reader *sdkmetric.ManualReader
}

func newTelemetryHarness(t *testing.T) *telemetryHarness {
	t.Helper()
	gin.SetMode(gin.TestMode)
	spans := tracetest.NewSpanRecorder()
	tp := sdktrace.NewTracerProvider(sdktrace.WithSpanProcessor(spans))
	reader := sdkmetric.NewManualReader()
	mp := sdkmetric.NewMeterProvider(sdkmetric.WithReader(reader))

	e := gin.New()
	e.Use(RequestID())
	e.Use(HTTPTelemetry(HTTPTelemetryConfig{
		TracerProvider:  tp,
		MeterProvider:   mp,
		Propagator:      propagation.TraceContext{},
		Tracing:         true,
		Metrics:         true,
		SkipTracing:     DefaultSkipTracing(),
		SkipMetrics:     map[string]bool{"/metrics": true},
		StreamingRoutes: DefaultStreamingRoutes(),
	}))
	e.GET("/transaction/:id", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"ok": true}) })
	e.GET("/boom", func(c *gin.Context) { c.Status(http.StatusInternalServerError) })
	e.GET("/health", func(c *gin.Context) { c.Status(http.StatusOK) })
	return &telemetryHarness{engine: e, spans: spans, reader: reader}
}

func (h *telemetryHarness) do(req *http.Request) *httptest.ResponseRecorder {
	rec := httptest.NewRecorder()
	h.engine.ServeHTTP(rec, req)
	return rec
}

func TestHTTPTelemetrySpanUsesRouteTemplateAndNoPII(t *testing.T) {
	h := newTelemetryHarness(t)
	req := httptest.NewRequest(http.MethodGet, "/transaction/3f2a9c?secret=1", nil)
	req.Header.Set("X-Forwarded-For", "203.0.113.9")
	req.Header.Set("User-Agent", "secret-agent")
	rec := h.do(req)

	ended := h.spans.Ended()
	if len(ended) != 1 {
		t.Fatalf("want 1 span, got %d", len(ended))
	}
	span := ended[0]
	if span.Name() != "GET /transaction/:id" {
		t.Fatalf("span name = %q, want route template", span.Name())
	}
	for _, kv := range span.Attributes() {
		v := kv.Value.Emit()
		if strings.Contains(v, "3f2a9c") || strings.Contains(v, "203.0.113.9") ||
			strings.Contains(v, "secret") {
			t.Errorf("span leaks raw path/IP/UA/query: %s=%s", kv.Key, v)
		}
	}
	if got := attr(span.Attributes(), "http.route"); got != "/transaction/:id" {
		t.Errorf("http.route = %q", got)
	}
	if got := attr(span.Attributes(), "http.request.id"); got == "" || got != rec.Header().Get(RequestIDHeader) {
		t.Errorf("span request id %q != response header %q", got, rec.Header().Get(RequestIDHeader))
	}
	if rec.Header().Get("X-Trace-ID") != span.SpanContext().TraceID().String() {
		t.Errorf("X-Trace-ID header must expose the trace id")
	}
}

func TestHTTPTelemetryContinuesUpstreamTrace(t *testing.T) {
	h := newTelemetryHarness(t)
	req := httptest.NewRequest(http.MethodGet, "/transaction/1", nil)
	req.Header.Set("traceparent", "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01")
	h.do(req)
	span := h.spans.Ended()[0]
	if span.SpanContext().TraceID().String() != "4bf92f3577b34da6a3ce929d0e0e4736" {
		t.Fatalf("trace id not continued: %s", span.SpanContext().TraceID())
	}
	if span.Parent().SpanID().String() != "00f067aa0ba902b7" {
		t.Fatalf("parent span id not continued: %s", span.Parent().SpanID())
	}
}

func TestHTTPTelemetryUnmatchedAnd5xx(t *testing.T) {
	h := newTelemetryHarness(t)
	h.do(httptest.NewRequest(http.MethodGet, "/no/such/9f8e7d", nil))
	h.do(httptest.NewRequest(http.MethodGet, "/boom", nil))
	h.do(httptest.NewRequest(http.MethodGet, "/health", nil)) // not traced

	ended := h.spans.Ended()
	if len(ended) != 2 {
		t.Fatalf("want 2 spans (health is skipped), got %d", len(ended))
	}
	if ended[0].Name() != "GET unmatched" {
		t.Errorf("unmatched span name = %q", ended[0].Name())
	}
	if ended[0].Status().Code == codes.Error {
		t.Errorf("4xx must not mark the server span as error")
	}
	if ended[1].Status().Code != codes.Error {
		t.Errorf("5xx must mark the server span as error")
	}
}

func TestHTTPTelemetryREDMetrics(t *testing.T) {
	h := newTelemetryHarness(t)
	h.do(httptest.NewRequest(http.MethodGet, "/transaction/1", nil))
	h.do(httptest.NewRequest(http.MethodGet, "/transaction/2", nil))
	h.do(httptest.NewRequest(http.MethodGet, "/boom", nil))
	h.do(httptest.NewRequest(http.MethodGet, "/nope", nil))

	var rm metricdata.ResourceMetrics
	if err := h.reader.Collect(context.Background(), &rm); err != nil {
		t.Fatal(err)
	}
	counts := map[string]uint64{}
	var sawActive bool
	for _, sm := range rm.ScopeMetrics {
		for _, m := range sm.Metrics {
			switch m.Name {
			case "http.server.request.duration":
				for _, dp := range m.Data.(metricdata.Histogram[float64]).DataPoints {
					route, _ := dp.Attributes.Value("http.route")
					class, _ := dp.Attributes.Value(StatusClassKey)
					counts[route.AsString()+" "+class.AsString()] += dp.Count
					if dp.Attributes.Len() != 3 {
						t.Errorf("duration must only carry method/route/status_class, got %v", dp.Attributes.ToSlice())
					}
				}
			case "http.server.active_requests":
				sawActive = true
				for _, dp := range m.Data.(metricdata.Sum[int64]).DataPoints {
					if dp.Value != 0 {
						t.Errorf("in-flight must return to 0, got %d", dp.Value)
					}
				}
			}
		}
	}
	want := map[string]uint64{"/transaction/:id 2xx": 2, "/boom 5xx": 1, "unmatched 4xx": 1}
	for k, v := range want {
		if counts[k] != v {
			t.Errorf("count[%s] = %d, want %d (all: %v)", k, counts[k], v, counts)
		}
	}
	if !sawActive {
		t.Error("missing http.server.active_requests")
	}
}

func TestHTTPTelemetryDisabledIsPassThrough(t *testing.T) {
	gin.SetMode(gin.TestMode)
	e := gin.New()
	e.Use(HTTPTelemetry(HTTPTelemetryConfig{}))
	e.GET("/x", func(c *gin.Context) { c.Status(http.StatusNoContent) })
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/x", nil))
	if rec.Code != http.StatusNoContent || rec.Header().Get("X-Trace-ID") != "" {
		t.Fatalf("disabled middleware must not alter the response: %d %v", rec.Code, rec.Header())
	}
}

func TestRequestID(t *testing.T) {
	gin.SetMode(gin.TestMode)
	e := gin.New()
	e.Use(RequestID())
	var fromCtx string
	e.GET("/x", func(c *gin.Context) {
		fromCtx = observability.RequestIDFromContext(c.Request.Context())
		c.Status(http.StatusOK)
	})

	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/x", nil))
	generated := rec.Header().Get(RequestIDHeader)
	if len(generated) != 36 || fromCtx != generated {
		t.Fatalf("want a generated uuid in header and context, got %q / %q", generated, fromCtx)
	}

	req := httptest.NewRequest(http.MethodGet, "/x", nil)
	req.Header.Set(RequestIDHeader, "next-proxy-1234abcd")
	rec = httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	if rec.Header().Get(RequestIDHeader) != "next-proxy-1234abcd" {
		t.Fatalf("a well-formed upstream id must be kept, got %q", rec.Header().Get(RequestIDHeader))
	}

	req = httptest.NewRequest(http.MethodGet, "/x", nil)
	req.Header.Set(RequestIDHeader, "bad id\n{\"level\":\"error\"}")
	rec = httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	if strings.Contains(rec.Header().Get(RequestIDHeader), "bad") {
		t.Fatal("a malformed upstream id must be replaced")
	}
}

func TestAccessLogModes(t *testing.T) {
	gin.SetMode(gin.TestMode)
	run := func(mode string, path string) []map[string]any {
		var buf bytes.Buffer
		e := gin.New()
		e.Use(RequestID())
		e.Use(AccessLog(config.LoggingConfig{AccessLog: mode, AccessLogSampleRate: 1}, zerolog.New(&buf)))
		e.GET("/account/:id", func(c *gin.Context) { c.Status(http.StatusOK) })
		e.GET("/boom", func(c *gin.Context) { c.Status(http.StatusBadGateway) })
		e.GET("/health", func(c *gin.Context) { c.Status(http.StatusOK) })
		e.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodGet, path, nil))
		var lines []map[string]any
		for _, l := range bytes.Split(bytes.TrimSpace(buf.Bytes()), []byte("\n")) {
			if len(l) == 0 {
				continue
			}
			var m map[string]any
			if err := json.Unmarshal(l, &m); err != nil {
				t.Fatalf("bad log line %q: %v", l, err)
			}
			lines = append(lines, m)
		}
		return lines
	}

	lines := run("all", "/account/abc-123?email=x@y.z")
	if len(lines) != 1 {
		t.Fatalf("all: want 1 line, got %d", len(lines))
	}
	l := lines[0]
	if l["route"] != "/account/:id" || l["status"] != float64(200) || l["request_id"] == "" {
		t.Errorf("unexpected access log line: %v", l)
	}
	raw, _ := json.Marshal(l)
	if strings.Contains(string(raw), "abc-123") || strings.Contains(string(raw), "x@y.z") {
		t.Errorf("access log leaks the raw path/query: %s", raw)
	}

	if n := len(run("errors", "/account/1")); n != 0 {
		t.Errorf("errors mode must skip 2xx, got %d lines", n)
	}
	if lines := run("errors", "/boom"); len(lines) != 1 || lines[0]["level"] != "error" {
		t.Errorf("errors mode must log 5xx at error level: %v", lines)
	}
	if n := len(run("all", "/health")); n != 0 {
		t.Errorf("successful health checks must not be logged, got %d", n)
	}
	if n := len(run("off", "/boom")); n != 0 {
		t.Errorf("off mode must log nothing, got %d", n)
	}
}

func attr(attrs []attribute.KeyValue, key string) string {
	for _, kv := range attrs {
		if string(kv.Key) == key {
			return kv.Value.Emit()
		}
	}
	return ""
}
