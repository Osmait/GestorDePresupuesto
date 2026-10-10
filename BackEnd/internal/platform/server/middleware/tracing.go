package middleware

import (
	"context"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/metric"
	"go.opentelemetry.io/otel/propagation"
	semconv "go.opentelemetry.io/otel/semconv/v1.37.0"
	"go.opentelemetry.io/otel/trace"

	"github.com/osmait/gestorDePresupuesto/internal/platform/observability"
	"github.com/osmait/gestorDePresupuesto/internal/platform/telemetry"
)

// UnmatchedRoute is the http.route label for requests that matched no route
// (404/405). The raw path is never used as a label or span name.
const UnmatchedRoute = "unmatched"

// StatusClassKey is the low-cardinality status label ("2xx", "5xx", ...).
const StatusClassKey = attribute.Key("http.response.status_class")

// HTTPTelemetryConfig configures HTTPTelemetry.
type HTTPTelemetryConfig struct {
	TracerProvider trace.TracerProvider
	MeterProvider  metric.MeterProvider
	// Propagator extracts the caller's W3C traceparent (defaults to the
	// global propagator).
	Propagator propagation.TextMapPropagator
	// Tracing / Metrics toggle each signal.
	Tracing bool
	Metrics bool
	// SkipTracing lists route templates that never get a span (health
	// checks, the scrape endpoint) — they are polled constantly.
	SkipTracing map[string]bool
	// SkipMetrics lists route templates excluded from all HTTP metrics.
	SkipMetrics map[string]bool
	// StreamingRoutes lists long-lived routes (SSE). They count as in-flight
	// requests but are excluded from the duration histogram so they do not
	// distort latency percentiles.
	StreamingRoutes map[string]bool
}

// DefaultSkipTracing are the routes polled by load balancers / Prometheus.
func DefaultSkipTracing() map[string]bool {
	return map[string]bool{
		"/health": true, "/health/live": true, "/health/ready": true,
		"/health/detailed": true, "/ping": true, "/metrics": true,
	}
}

// DefaultStreamingRoutes are the SSE endpoints.
func DefaultStreamingRoutes() map[string]bool {
	return map[string]bool{"/notifications": true, "/mcp/sse": true}
}

// HTTPTelemetry is the server-side OpenTelemetry middleware.
//
// Span names and the http.route label are always the gin route template
// ("GET /transaction/:id"), never the raw path, so ids do not explode
// cardinality; unmatched requests use "unmatched". No client IP, user agent,
// query string or user id is recorded.
//
// Metrics (RED):
//   - http.server.request.duration  histogram (s) {method, route, status_class}
//   - http.server.active_requests   up/down counter {method, route}
func HTTPTelemetry(cfg HTTPTelemetryConfig) gin.HandlerFunc {
	if !cfg.Tracing && !cfg.Metrics {
		return func(c *gin.Context) { c.Next() }
	}
	if cfg.TracerProvider == nil {
		cfg.TracerProvider = otel.GetTracerProvider()
	}
	if cfg.MeterProvider == nil {
		cfg.MeterProvider = otel.GetMeterProvider()
	}
	if cfg.Propagator == nil {
		cfg.Propagator = otel.GetTextMapPropagator()
	}

	tracer := cfg.TracerProvider.Tracer(telemetry.ScopeName + "/http")
	meter := cfg.MeterProvider.Meter(telemetry.ScopeName + "/http")

	duration, _ := meter.Float64Histogram(
		"http.server.request.duration",
		metric.WithDescription("Duration of HTTP server requests."),
		metric.WithUnit("s"),
		metric.WithExplicitBucketBoundaries(telemetry.LatencyBuckets...),
	)
	active, _ := meter.Int64UpDownCounter(
		"http.server.active_requests",
		metric.WithDescription("Number of in-flight HTTP server requests."),
		metric.WithUnit("{request}"),
	)

	return func(c *gin.Context) {
		route := c.FullPath()
		if route == "" {
			route = UnmatchedRoute
		}
		method := normalizeMethod(c.Request.Method)

		doTrace := cfg.Tracing && !cfg.SkipTracing[route]
		doMetrics := cfg.Metrics && !cfg.SkipMetrics[route]

		var span trace.Span
		if doTrace {
			ctx := cfg.Propagator.Extract(c.Request.Context(), propagation.HeaderCarrier(c.Request.Header))
			attrs := []attribute.KeyValue{
				semconv.HTTPRequestMethodKey.String(method),
				semconv.HTTPRoute(route),
				semconv.URLScheme(scheme(c.Request)),
			}
			if rid := observability.RequestIDFromContext(ctx); rid != "" {
				attrs = append(attrs, attribute.String("http.request.id", rid))
			}
			ctx, span = tracer.Start(ctx, method+" "+route,
				trace.WithSpanKind(trace.SpanKindServer),
				trace.WithAttributes(attrs...),
			)
			c.Request = c.Request.WithContext(ctx)
			if sc := span.SpanContext(); sc.IsSampled() {
				// Lets a developer jump from a response in devtools to Jaeger.
				c.Header("X-Trace-ID", sc.TraceID().String())
			}
		}

		var metricAttrs []attribute.KeyValue
		if doMetrics {
			metricAttrs = []attribute.KeyValue{
				semconv.HTTPRequestMethodKey.String(method),
				semconv.HTTPRoute(route),
			}
			set := metric.WithAttributeSet(attribute.NewSet(metricAttrs...))
			active.Add(c.Request.Context(), 1, set)
			defer active.Add(context.WithoutCancel(c.Request.Context()), -1, set)
		}

		start := time.Now()
		c.Next()
		elapsed := time.Since(start)
		status := c.Writer.Status()

		if doMetrics && !cfg.StreamingRoutes[route] {
			duration.Record(c.Request.Context(), elapsed.Seconds(), metric.WithAttributeSet(attribute.NewSet(
				append(metricAttrs, StatusClassKey.String(StatusClass(status)))...,
			)))
		}

		if span != nil {
			span.SetAttributes(semconv.HTTPResponseStatusCode(status))
			if size := c.Writer.Size(); size >= 0 {
				span.SetAttributes(semconv.HTTPResponseBodySize(size))
			}
			if status >= http.StatusInternalServerError {
				// Per HTTP semconv only 5xx marks a server span as failed.
				span.SetStatus(codes.Error, http.StatusText(status))
				span.SetAttributes(semconv.ErrorTypeKey.String(StatusClass(status)))
			}
			if len(c.Errors) > 0 {
				span.AddEvent("handler.errors", trace.WithAttributes(attribute.Int("count", len(c.Errors))))
			}
			span.End()
		}
	}
}

// StatusClass returns "1xx".."5xx".
func StatusClass(status int) string {
	switch {
	case status < 200:
		return "1xx"
	case status < 300:
		return "2xx"
	case status < 400:
		return "3xx"
	case status < 500:
		return "4xx"
	default:
		return "5xx"
	}
}

// normalizeMethod bounds the method label to the standard verbs.
func normalizeMethod(m string) string {
	switch m {
	case http.MethodGet, http.MethodPost, http.MethodPut, http.MethodPatch,
		http.MethodDelete, http.MethodHead, http.MethodOptions:
		return m
	default:
		return "_OTHER"
	}
}

func scheme(r *http.Request) string {
	if r.TLS != nil {
		return "https"
	}
	if p := strings.ToLower(r.Header.Get("X-Forwarded-Proto")); p == "https" {
		return p
	}
	return "http"
}

// StartSpan starts an internal span with the application tracer.
func StartSpan(ctx context.Context, name string, opts ...trace.SpanStartOption) (context.Context, trace.Span) {
	return otel.Tracer(telemetry.ScopeName).Start(ctx, name, opts...)
}

// SpanFromContext returns the span from the context
func SpanFromContext(ctx context.Context) trace.Span {
	return trace.SpanFromContext(ctx)
}

// AddSpanEvent adds an event to the span in the context
func AddSpanEvent(ctx context.Context, name string, attrs ...attribute.KeyValue) {
	trace.SpanFromContext(ctx).AddEvent(name, trace.WithAttributes(attrs...))
}

// AddSpanError records an error in the span
func AddSpanError(ctx context.Context, err error, attrs ...attribute.KeyValue) {
	span := trace.SpanFromContext(ctx)
	span.RecordError(err, trace.WithAttributes(attrs...))
	span.SetStatus(codes.Error, err.Error())
}

// AddSpanAttributes adds attributes to the span
func AddSpanAttributes(ctx context.Context, attrs ...attribute.KeyValue) {
	trace.SpanFromContext(ctx).SetAttributes(attrs...)
}
