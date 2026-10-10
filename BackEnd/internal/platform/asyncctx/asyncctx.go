// Package asyncctx builds contexts for work that outlives the HTTP request
// that started it (notifications, cache warm-ups).
//
// Never hand the *gin.Context, or a context derived from the request, to a
// goroutine that may still run after the handler returned: gin recycles the
// *gin.Context for the next request (data race), the request context is
// cancelled when the response is done, and it carries the request-scoped RLS
// transaction (txhelper), which is committed or rolled back — and its
// connection returned to the pool — as soon as the handler chain ends.
package asyncctx

import (
	"context"

	apperrors "github.com/osmait/gestorDePresupuesto/internal/platform/errors"
	"github.com/osmait/gestorDePresupuesto/internal/platform/i18n"
	"github.com/osmait/gestorDePresupuesto/internal/platform/observability"
	"go.opentelemetry.io/otel/trace"
)

// Detach returns a context that is never cancelled by ctx and copies only
// the values asynchronous work legitimately needs: the trace span (so its
// spans stay in the request trace), the request id and the locale.
//
// It deliberately does not use context.WithoutCancel(ctx), which would keep
// every value of ctx — including the request transaction, its after-commit
// hooks and, for a *gin.Context, the recycled gin context itself.
// Callers bound the work with their own timeout.
func Detach(ctx context.Context) context.Context {
	out := context.Background()
	if ctx == nil {
		return out
	}
	if span := trace.SpanFromContext(ctx); span.SpanContext().IsValid() {
		out = trace.ContextWithSpan(out, span)
	}
	if id := observability.RequestIDFromContext(ctx); id != "" {
		out = observability.ContextWithRequestID(out, id)
		out = context.WithValue(out, apperrors.ContextKeyRequestID, id)
	}
	return i18n.WithLocale(out, i18n.FromContext(ctx))
}
