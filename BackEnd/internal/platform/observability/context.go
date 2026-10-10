package observability

import (
	"context"

	"github.com/rs/zerolog"
	"go.opentelemetry.io/otel/trace"
)

// Log field names shared by the access log, WithContext and TraceHook.
const (
	RequestIDField = "request_id"
	TraceIDField   = "trace_id"
	SpanIDField    = "span_id"
)

type requestIDKey struct{}

// ContextWithRequestID stores the request id in ctx.
func ContextWithRequestID(ctx context.Context, id string) context.Context {
	return context.WithValue(ctx, requestIDKey{}, id)
}

// RequestIDFromContext returns the request id stored by ContextWithRequestID.
func RequestIDFromContext(ctx context.Context) string {
	if ctx == nil {
		return ""
	}
	id, _ := ctx.Value(requestIDKey{}).(string)
	return id
}

// TraceHook is a zerolog hook that adds request_id / trace_id / span_id to
// events logged with a context (log.Info().Ctx(ctx)...).
type TraceHook struct{}

// Run implements zerolog.Hook.
func (TraceHook) Run(e *zerolog.Event, _ zerolog.Level, _ string) {
	ctx := e.GetCtx()
	if ctx == nil || ctx == context.Background() {
		return
	}
	if rid := RequestIDFromContext(ctx); rid != "" {
		e.Str(RequestIDField, rid)
	}
	if sc := trace.SpanContextFromContext(ctx); sc.IsValid() {
		e.Str(TraceIDField, sc.TraceID().String()).Str(SpanIDField, sc.SpanID().String())
	}
}
