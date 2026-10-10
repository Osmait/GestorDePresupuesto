package worker

import (
	"context"
	"errors"
	"testing"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/codes"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/sdk/trace/tracetest"
	"go.opentelemetry.io/otel/trace"
)

func TestInstrumentedRunCreatesRootSpan(t *testing.T) {
	rec := tracetest.NewSpanRecorder()
	prev := otel.GetTracerProvider()
	otel.SetTracerProvider(sdktrace.NewTracerProvider(sdktrace.WithSpanProcessor(rec)))
	t.Cleanup(func() { otel.SetTracerProvider(prev) })

	var inner trace.SpanContext
	err := instrumentedRun(context.Background(), "demo_cleanup", func(ctx context.Context) error {
		inner = trace.SpanContextFromContext(ctx)
		return errors.New("db down")
	})
	if err == nil {
		t.Fatal("error must be returned to the caller")
	}
	spans := rec.Ended()
	if len(spans) != 1 || spans[0].Name() != "worker demo_cleanup" {
		t.Fatalf("unexpected spans: %v", spans)
	}
	if spans[0].Status().Code != codes.Error {
		t.Error("failed run must mark the span as error")
	}
	if inner.SpanID() != spans[0].SpanContext().SpanID() {
		t.Error("the job must receive the worker span in its context (DB spans become children)")
	}
}
