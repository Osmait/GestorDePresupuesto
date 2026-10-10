package worker

import (
	"context"
	"sync"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/metric"
	"go.opentelemetry.io/otel/trace"
)

const scopeName = "github.com/osmait/gestorDePresupuesto/worker"

var (
	instrumentsOnce sync.Once
	runDuration     metric.Float64Histogram
	lastRun         metric.Float64Gauge
)

// initInstruments creates the worker instruments from the global
// MeterProvider (a delegating no-op until telemetry.Setup installs the SDK).
func initInstruments() {
	instrumentsOnce.Do(func() {
		meter := otel.Meter(scopeName)
		runDuration, _ = meter.Float64Histogram("worker.run.duration",
			metric.WithDescription("Duration of background worker runs, by worker and outcome."),
			metric.WithUnit("s"))
		lastRun, _ = meter.Float64Gauge("worker.last_run.timestamp",
			metric.WithDescription("Unix time of the last completed run, by worker and outcome."),
			metric.WithUnit("s"))
	})
}

// instrumentedRun executes fn as one worker run: a new root span
// "worker <name>" (DB queries become its children) plus the
// worker.run.duration histogram and worker.last_run.timestamp gauge
// labelled {worker, outcome=success|error}.
func instrumentedRun(ctx context.Context, name string, fn func(context.Context) error) error {
	initInstruments()
	ctx, span := otel.Tracer(scopeName).Start(ctx, "worker "+name,
		trace.WithNewRoot(),
		trace.WithSpanKind(trace.SpanKindInternal),
		trace.WithAttributes(attribute.String("worker.name", name)),
	)
	defer span.End()

	start := time.Now()
	err := fn(ctx)
	outcome := "success"
	if err != nil {
		outcome = "error"
		span.RecordError(err)
		span.SetStatus(codes.Error, "worker run failed")
	}
	attrs := metric.WithAttributes(attribute.String("worker", name), attribute.String("outcome", outcome))
	runDuration.Record(ctx, time.Since(start).Seconds(), attrs)
	lastRun.Record(ctx, float64(time.Now().Unix()), attrs)
	return err
}
