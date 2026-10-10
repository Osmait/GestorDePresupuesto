package observability

import (
	"bytes"
	"context"
	"encoding/json"
	"testing"

	"github.com/rs/zerolog"
	"go.opentelemetry.io/otel/trace"
)

func spanCtx() context.Context {
	sc := trace.NewSpanContext(trace.SpanContextConfig{
		TraceID:    trace.TraceID{0xaa, 1},
		SpanID:     trace.SpanID{0xbb, 2},
		TraceFlags: trace.FlagsSampled,
	})
	ctx := trace.ContextWithSpanContext(context.Background(), sc)
	return ContextWithRequestID(ctx, "req-12345678")
}

func decode(t *testing.T, b []byte) map[string]any {
	t.Helper()
	var m map[string]any
	if err := json.Unmarshal(bytes.TrimSpace(b), &m); err != nil {
		t.Fatalf("bad json %q: %v", b, err)
	}
	return m
}

func TestLoggerWithContextAddsTraceAndRequestIDs(t *testing.T) {
	var buf bytes.Buffer
	l := &Logger{logger: zerolog.New(&buf)}
	l.WithContext(spanCtx()).Info("hello")
	m := decode(t, buf.Bytes())
	if m[TraceIDField] != "aa010000000000000000000000000000" || m[SpanIDField] != "bb02000000000000" || m[RequestIDField] != "req-12345678" {
		t.Fatalf("missing correlation fields: %v", m)
	}

	buf.Reset()
	l.WithContext(context.Background()).Info("plain")
	if m := decode(t, buf.Bytes()); m[TraceIDField] != nil {
		t.Fatalf("no trace id expected without a span: %v", m)
	}
}

func TestTraceHookUsesEventContext(t *testing.T) {
	var buf bytes.Buffer
	zl := zerolog.New(&buf).Hook(TraceHook{})
	zl.Info().Ctx(spanCtx()).Msg("x")
	if m := decode(t, buf.Bytes()); m[TraceIDField] == nil || m[RequestIDField] != "req-12345678" {
		t.Fatalf("hook did not add ids: %v", m)
	}
}
