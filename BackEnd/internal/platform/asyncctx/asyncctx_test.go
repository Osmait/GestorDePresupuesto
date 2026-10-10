package asyncctx

import (
	"context"
	"database/sql"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/osmait/gestorDePresupuesto/internal/platform/i18n"
	"github.com/osmait/gestorDePresupuesto/internal/platform/observability"
	"github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/txhelper"
	"github.com/stretchr/testify/assert"
	"go.opentelemetry.io/otel/trace"
)

func TestDetach_CopiesValuesDropsTxAndCancellation(t *testing.T) {
	sc := trace.NewSpanContext(trace.SpanContextConfig{
		TraceID:    trace.TraceID{1},
		SpanID:     trace.SpanID{2},
		TraceFlags: trace.FlagsSampled,
	})
	ctx := trace.ContextWithSpanContext(context.Background(), sc)
	ctx = observability.ContextWithRequestID(ctx, "req-12345678")
	ctx = i18n.WithLocale(ctx, i18n.EN)
	ctx = txhelper.WithTx(ctx, &sql.Tx{})
	ctx, cancel := context.WithCancel(ctx)
	cancel()

	d := Detach(ctx)

	assert.NoError(t, d.Err(), "detached context must not inherit cancellation")
	assert.Nil(t, d.Done())
	assert.Equal(t, sc.TraceID(), trace.SpanContextFromContext(d).TraceID())
	assert.Equal(t, "req-12345678", observability.RequestIDFromContext(d))
	assert.Equal(t, i18n.EN, i18n.FromContext(d))
	var db *sql.DB
	assert.Equal(t, txhelper.Querier(db), txhelper.FromContext(d, db), "the request transaction must not leak")
}

func TestDetach_FromGinContextKeepsNoReference(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest("GET", "/", nil)
	c.Request = c.Request.WithContext(i18n.WithLocale(c.Request.Context(), i18n.EN))
	c.Set("db_tx", &sql.Tx{})

	d := Detach(c)

	assert.Nil(t, d.Value(gin.ContextKey))
	assert.Equal(t, i18n.EN, i18n.FromContext(d))
	var db *sql.DB
	assert.Equal(t, txhelper.Querier(db), txhelper.FromContext(d, db))
}
