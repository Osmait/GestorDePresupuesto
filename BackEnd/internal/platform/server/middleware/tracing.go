package middleware

import (
	"context"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/metric"
	"go.opentelemetry.io/otel/propagation"
	semconv "go.opentelemetry.io/otel/semconv/v1.26.0"
	"go.opentelemetry.io/otel/trace"
)

// TracingMiddleware creates a new tracing middleware
func TracingMiddleware(serviceName string) gin.HandlerFunc {
	// Get tracer and meter
	tracer := otel.Tracer(serviceName)
	meter := otel.Meter(serviceName)

	// Create metrics instruments
	requestDuration, _ := meter.Float64Histogram(
		"http_request_duration_seconds",
		metric.WithDescription("Duration of HTTP requests in seconds"),
		metric.WithUnit("s"),
	)

	requestCount, _ := meter.Int64Counter(
		"http_requests_total",
		metric.WithDescription("Total number of HTTP requests"),
	)

	activeRequests, _ := meter.Int64UpDownCounter(
		"http_active_requests",
		metric.WithDescription("Number of active HTTP requests"),
	)

	requestSize, _ := meter.Int64Histogram(
		"http_request_size_bytes",
		metric.WithDescription("Size of HTTP request in bytes"),
		metric.WithUnit("By"),
	)

	responseSize, _ := meter.Int64Histogram(
		"http_response_size_bytes",
		metric.WithDescription("Size of HTTP response in bytes"),
		metric.WithUnit("By"),
	)

	return func(c *gin.Context) {
		// Extract context from headers
		ctx := otel.GetTextMapPropagator().Extract(c.Request.Context(), propagation.HeaderCarrier(c.Request.Header))

		// Create span
		spanName := c.Request.Method + " " + c.FullPath()
		if spanName == "" {
			spanName = c.Request.Method + " " + c.Request.URL.Path
		}

		ctx, span := tracer.Start(ctx, spanName,
			trace.WithSpanKind(trace.SpanKindServer),
			trace.WithAttributes(
				attribute.String("http.method", c.Request.Method),
				attribute.String("http.url", c.Request.URL.String()),
				semconv.HTTPRoute(c.FullPath()),
				attribute.String("http.scheme", c.Request.URL.Scheme),
				attribute.String("http.host", c.Request.Host),
				attribute.String("http.user_agent", c.Request.UserAgent()),
				attribute.Int64("http.request_content_length", c.Request.ContentLength),
				attribute.String("http.client_ip", c.ClientIP()),
				attribute.String("http.remote_addr", c.Request.RemoteAddr),
			),
		)
		defer span.End()

		// Set context in gin context
		c.Request = c.Request.WithContext(ctx)

		// Metrics: Record request start
		startTime := time.Now()

		// Common attributes for metrics
		attrs := []attribute.KeyValue{
			attribute.String("method", c.Request.Method),
			attribute.String("route", c.FullPath()),
			attribute.String("host", c.Request.Host),
		}

		// Record active requests
		activeRequests.Add(ctx, 1, metric.WithAttributes(attrs...))
		defer activeRequests.Add(ctx, -1, metric.WithAttributes(attrs...))

		// Record request size
		if c.Request.ContentLength > 0 {
			requestSize.Record(ctx, c.Request.ContentLength, metric.WithAttributes(attrs...))
		}

		// Create response writer wrapper to capture response size
		wrappedWriter := &responseWriterWrapper{
			ResponseWriter: c.Writer,
			size:           0,
		}
		c.Writer = wrappedWriter

		// Process request
		c.Next()

		// Record metrics after request completion
		duration := time.Since(startTime).Seconds()
		status := c.Writer.Status()

		// Add status code to attributes
		finalAttrs := append(attrs,
			attribute.Int("status_code", status),
			attribute.String("status_class", getStatusClass(status)),
		)

		// Record metrics
		requestDuration.Record(ctx, duration, metric.WithAttributes(finalAttrs...))
		requestCount.Add(ctx, 1, metric.WithAttributes(finalAttrs...))

		if wrappedWriter.size > 0 {
			responseSize.Record(ctx, int64(wrappedWriter.size), metric.WithAttributes(finalAttrs...))
		}

		// Set span status and attributes
		span.SetAttributes(
			semconv.HTTPResponseStatusCode(status),
			attribute.Int64("http.response_content_length", int64(wrappedWriter.size)),
		)

		// Set span status based on HTTP status code
		if status >= 400 {
			span.SetStatus(codes.Error, "HTTP "+http.StatusText(status))
			span.RecordError(gin.Error{
				Err:  http.ErrAbortHandler,
				Meta: "HTTP " + http.StatusText(status),
			})
		} else {
			span.SetStatus(codes.Ok, "")
		}

		// Add trace ID to response headers for correlation
		if traceID := span.SpanContext().TraceID(); traceID.IsValid() {
			c.Header("X-Trace-ID", traceID.String())
		}

		// Add span ID to response headers
		if spanID := span.SpanContext().SpanID(); spanID.IsValid() {
			c.Header("X-Span-ID", spanID.String())
		}
	}
}

// responseWriterWrapper wraps gin.ResponseWriter to capture response size
type responseWriterWrapper struct {
	gin.ResponseWriter
	size int
}

func (w *responseWriterWrapper) Write(data []byte) (int, error) {
	size, err := w.ResponseWriter.Write(data)
	w.size += size
	return size, err
}

func (w *responseWriterWrapper) WriteString(s string) (int, error) {
	size, err := w.ResponseWriter.WriteString(s)
	w.size += size
	return size, err
}

// getStatusClass returns the status class (1xx, 2xx, 3xx, 4xx, 5xx)
func getStatusClass(status int) string {
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

// StartSpan starts a new span with the given name and context
func StartSpan(ctx context.Context, name string, opts ...trace.SpanStartOption) (context.Context, trace.Span) {
	return otel.Tracer("gestor-de-presupuesto").Start(ctx, name, opts...)
}

// SpanFromContext returns the span from the context
func SpanFromContext(ctx context.Context) trace.Span {
	return trace.SpanFromContext(ctx)
}

// AddSpanEvent adds an event to the span in the context
func AddSpanEvent(ctx context.Context, name string, attrs ...attribute.KeyValue) {
	if span := trace.SpanFromContext(ctx); span != nil {
		span.AddEvent(name, trace.WithAttributes(attrs...))
	}
}

// AddSpanError records an error in the span
func AddSpanError(ctx context.Context, err error, attrs ...attribute.KeyValue) {
	if span := trace.SpanFromContext(ctx); span != nil {
		span.RecordError(err, trace.WithAttributes(attrs...))
		span.SetStatus(codes.Error, err.Error())
	}
}

// AddSpanAttributes adds attributes to the span
func AddSpanAttributes(ctx context.Context, attrs ...attribute.KeyValue) {
	if span := trace.SpanFromContext(ctx); span != nil {
		span.SetAttributes(attrs...)
	}
}
