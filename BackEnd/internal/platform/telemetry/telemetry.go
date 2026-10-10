// Package telemetry wires OpenTelemetry tracing and metrics for the API.
//
// Everything is opt-in: with ENABLE_TRACING=false and METRICS_ENABLED=false
// (the defaults) Setup installs nothing, the global OpenTelemetry providers
// stay no-ops, the database is opened with the plain driver and no /metrics
// endpoint exists — production behaviour is unchanged.
package telemetry

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	rtmetrics "runtime/metrics"
	"strings"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/collectors"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/rs/zerolog/log"
	"go.opentelemetry.io/contrib/instrumentation/runtime"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetricgrpc"
	"go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetrichttp"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	otelprom "go.opentelemetry.io/otel/exporters/prometheus"
	"go.opentelemetry.io/otel/metric"
	metricnoop "go.opentelemetry.io/otel/metric/noop"
	"go.opentelemetry.io/otel/propagation"
	sdkmetric "go.opentelemetry.io/otel/sdk/metric"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.37.0"
	"go.opentelemetry.io/otel/trace"
	tracenoop "go.opentelemetry.io/otel/trace/noop"

	"github.com/osmait/gestorDePresupuesto/internal/config"
)

// ScopeName is the instrumentation scope used by the app's own spans/metrics.
const ScopeName = "github.com/osmait/gestorDePresupuesto"

// LatencyBuckets are the histogram boundaries (seconds) used for HTTP, DB,
// outgoing-HTTP and worker durations: fine-grained below 100ms where most API
// calls land, coarse up to 10s.
var LatencyBuckets = []float64{
	0.001, 0.0025, 0.005, 0.01, 0.025, 0.05, 0.075, 0.1, 0.15, 0.25, 0.5, 0.75, 1, 2.5, 5, 10,
}

// Telemetry holds the configured providers. The zero value (from a disabled
// Setup) is valid: it reports both signals off and returns no-op providers.
type Telemetry struct {
	tracingEnabled bool
	metricsEnabled bool

	tp *sdktrace.TracerProvider
	mp *sdkmetric.MeterProvider

	metricsHandler http.Handler
	shutdowns      []func(context.Context) error
}

// Disabled returns a Telemetry with every signal off.
func Disabled() *Telemetry { return &Telemetry{} }

// TracingEnabled reports whether spans are created and exported.
func (t *Telemetry) TracingEnabled() bool { return t != nil && t.tracingEnabled }

// MetricsEnabled reports whether metrics are recorded.
func (t *Telemetry) MetricsEnabled() bool { return t != nil && t.metricsEnabled }

// Enabled reports whether any signal is on.
func (t *Telemetry) Enabled() bool { return t.TracingEnabled() || t.MetricsEnabled() }

// TracerProvider returns the SDK provider, or a no-op one when tracing is off.
func (t *Telemetry) TracerProvider() trace.TracerProvider {
	if t == nil || t.tp == nil {
		return tracenoop.NewTracerProvider()
	}
	return t.tp
}

// MeterProvider returns the SDK provider, or a no-op one when metrics are off.
func (t *Telemetry) MeterProvider() metric.MeterProvider {
	if t == nil || t.mp == nil {
		return metricnoop.NewMeterProvider()
	}
	return t.mp
}

// MetricsHandler is the Prometheus scrape handler (nil unless metrics are
// enabled with the prometheus exporter). It is NOT authenticated: wrap it with
// BearerAuth or serve it on an internal port.
func (t *Telemetry) MetricsHandler() http.Handler {
	if t == nil {
		return nil
	}
	return t.metricsHandler
}

// Shutdown flushes pending spans/metrics and stops the exporters.
func (t *Telemetry) Shutdown(ctx context.Context) error {
	if t == nil {
		return nil
	}
	var errs []error
	for i := len(t.shutdowns) - 1; i >= 0; i-- {
		if err := t.shutdowns[i](ctx); err != nil {
			errs = append(errs, err)
		}
	}
	return errors.Join(errs...)
}

// Setup builds the tracer and meter providers described by cfg and installs
// them (plus the W3C trace-context propagator) as OpenTelemetry globals.
func Setup(ctx context.Context, cfg *config.Config) (*Telemetry, error) {
	t := &Telemetry{
		tracingEnabled: cfg.FeatureFlags.EnableTracing,
		metricsEnabled: cfg.Metrics.Enabled,
	}
	if !t.Enabled() {
		return t, nil
	}

	res, err := newResource(ctx, cfg)
	if err != nil {
		return nil, err
	}

	otel.SetErrorHandler(otel.ErrorHandlerFunc(func(err error) {
		// Exporter errors (collector down, auth) must never break requests;
		// log them at warn so a misconfigured endpoint is still visible.
		log.Warn().Err(err).Msg("opentelemetry error")
	}))

	if t.tracingEnabled {
		if err := t.setupTracing(ctx, cfg, res); err != nil {
			_ = t.Shutdown(ctx)
			return nil, err
		}
	}
	if t.metricsEnabled {
		if err := t.setupMetrics(ctx, cfg, res); err != nil {
			_ = t.Shutdown(ctx)
			return nil, err
		}
	}

	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(
		propagation.TraceContext{}, propagation.Baggage{},
	))
	return t, nil
}

func newResource(ctx context.Context, cfg *config.Config) (*resource.Resource, error) {
	attrs := []attribute.KeyValue{
		semconv.ServiceName(cfg.OpenTelemetry.ServiceName),
		semconv.ServiceVersion(cfg.OpenTelemetry.ServiceVersion),
		semconv.DeploymentEnvironmentName(cfg.OpenTelemetry.Environment),
	}
	for k, v := range cfg.OpenTelemetry.Attributes {
		attrs = append(attrs, attribute.String(k, v))
	}
	// No schema URL: avoids conflicts when merging with detector resources.
	res, err := resource.New(ctx,
		resource.WithTelemetrySDK(),
		resource.WithHost(),
		resource.WithFromEnv(), // OTEL_RESOURCE_ATTRIBUTES
		resource.WithAttributes(attrs...),
	)
	if err != nil && res == nil {
		return nil, fmt.Errorf("telemetry resource: %w", err)
	}
	return res, nil
}

// Sampler is parent-based (a sampled upstream span, e.g. from the Next.js
// proxy, is always continued) with a trace-id ratio for new root traces.
func Sampler(rate float64) sdktrace.Sampler {
	switch {
	case rate >= 1:
		return sdktrace.ParentBased(sdktrace.AlwaysSample())
	case rate <= 0:
		return sdktrace.ParentBased(sdktrace.NeverSample())
	default:
		return sdktrace.ParentBased(sdktrace.TraceIDRatioBased(rate))
	}
}

func (t *Telemetry) setupTracing(ctx context.Context, cfg *config.Config, res *resource.Resource) error {
	exp, err := newTraceExporter(ctx, cfg.OpenTelemetry)
	if err != nil {
		return fmt.Errorf("trace exporter: %w", err)
	}
	oc := cfg.OpenTelemetry
	bsp := []sdktrace.BatchSpanProcessorOption{}
	if oc.BatchTimeout > 0 {
		bsp = append(bsp, sdktrace.WithBatchTimeout(oc.BatchTimeout))
	}
	if oc.MaxBatchSize > 0 {
		bsp = append(bsp, sdktrace.WithMaxExportBatchSize(oc.MaxBatchSize))
	}
	if oc.MaxQueueSize > 0 {
		bsp = append(bsp, sdktrace.WithMaxQueueSize(oc.MaxQueueSize))
	}
	t.tp = sdktrace.NewTracerProvider(
		sdktrace.WithResource(res),
		sdktrace.WithSampler(Sampler(oc.SamplingRate)),
		sdktrace.WithBatcher(exp, bsp...),
	)
	t.shutdowns = append(t.shutdowns, t.tp.Shutdown)
	otel.SetTracerProvider(t.tp)
	return nil
}

func (t *Telemetry) setupMetrics(ctx context.Context, cfg *config.Config, res *resource.Resource) error {
	opts := []sdkmetric.Option{
		sdkmetric.WithResource(res),
		sdkmetric.WithView(latencyView("http.server.request.duration"),
			latencyView("http.client.request.duration"),
			latencyView("db.client.operation.duration"),
			latencyView("worker.run.duration")),
	}

	if cfg.Metrics.HasExporter("prometheus") {
		reg := prometheus.NewRegistry()
		reg.MustRegister(collectors.NewProcessCollector(collectors.ProcessCollectorOpts{}))
		exp, err := otelprom.New(
			otelprom.WithRegisterer(reg),
			otelprom.WithoutScopeInfo(),
		)
		if err != nil {
			return fmt.Errorf("prometheus exporter: %w", err)
		}
		opts = append(opts, sdkmetric.WithReader(exp))
		t.metricsHandler = promhttp.HandlerFor(reg, promhttp.HandlerOpts{})
	}
	if cfg.Metrics.HasExporter("otlp") {
		exp, err := newMetricExporter(ctx, cfg.OpenTelemetry)
		if err != nil {
			return fmt.Errorf("otlp metric exporter: %w", err)
		}
		interval := cfg.Metrics.ExportInterval
		if interval <= 0 {
			interval = 30 * time.Second
		}
		opts = append(opts, sdkmetric.WithReader(sdkmetric.NewPeriodicReader(exp, sdkmetric.WithInterval(interval))))
	}

	t.mp = sdkmetric.NewMeterProvider(opts...)
	t.shutdowns = append(t.shutdowns, t.mp.Shutdown)
	otel.SetMeterProvider(t.mp)

	if err := runtime.Start(
		runtime.WithMeterProvider(t.mp),
		runtime.WithMinimumReadMemStatsInterval(15*time.Second),
	); err != nil {
		return fmt.Errorf("runtime metrics: %w", err)
	}
	if err := registerProcessCPU(t.mp.Meter(ScopeName)); err != nil {
		return fmt.Errorf("process cpu metric: %w", err)
	}
	return nil
}

// registerProcessCPU exports process.cpu.time (seconds of CPU used by the Go
// process) from runtime/metrics, so CPU saturation is visible over OTLP too
// (the Prometheus process collector only feeds the /metrics endpoint).
func registerProcessCPU(meter metric.Meter) error {
	samples := []rtmetrics.Sample{
		{Name: "/cpu/classes/total:cpu-seconds"},
		{Name: "/cpu/classes/idle:cpu-seconds"},
	}
	_, err := meter.Float64ObservableCounter("process.cpu.time",
		metric.WithDescription("CPU seconds used by the process (Go runtime estimate)."),
		metric.WithUnit("s"),
		metric.WithFloat64Callback(func(_ context.Context, o metric.Float64Observer) error {
			s := make([]rtmetrics.Sample, len(samples))
			copy(s, samples)
			rtmetrics.Read(s)
			if s[0].Value.Kind() != rtmetrics.KindFloat64 || s[1].Value.Kind() != rtmetrics.KindFloat64 {
				return nil
			}
			o.Observe(s[0].Value.Float64() - s[1].Value.Float64())
			return nil
		}),
	)
	return err
}

func latencyView(name string) sdkmetric.View {
	return sdkmetric.NewView(
		sdkmetric.Instrument{Name: name},
		sdkmetric.Stream{Aggregation: sdkmetric.AggregationExplicitBucketHistogram{Boundaries: LatencyBuckets}},
	)
}

// isHTTPProtocol reports whether the OTLP/HTTP (protobuf) transport is used.
func isHTTPProtocol(p string) bool {
	return p == "http/protobuf" || p == "http"
}

// signalURL appends the OTLP/HTTP signal path ("/v1/traces") to a base
// endpoint such as https://otlp-gateway-prod-us-east-0.grafana.net/otlp.
func signalURL(endpoint, signalPath string) (string, error) {
	u, err := url.Parse(endpoint)
	if err != nil {
		return "", err
	}
	if !strings.HasSuffix(u.Path, signalPath) {
		u.Path = strings.TrimSuffix(u.Path, "/") + signalPath
	}
	return u.String(), nil
}

func newTraceExporter(ctx context.Context, oc config.OpenTelemetryConfig) (sdktrace.SpanExporter, error) {
	if isHTTPProtocol(oc.OTLPProtocol) {
		endpoint, err := signalURL(oc.OTLPEndpoint, "/v1/traces")
		if err != nil {
			return nil, err
		}
		opts := []otlptracehttp.Option{otlptracehttp.WithEndpointURL(endpoint), otlptracehttp.WithTimeout(10 * time.Second)}
		if len(oc.Headers) > 0 {
			opts = append(opts, otlptracehttp.WithHeaders(oc.Headers))
		}
		if oc.EnableCompression {
			opts = append(opts, otlptracehttp.WithCompression(otlptracehttp.GzipCompression))
		}
		return otlptracehttp.New(ctx, opts...)
	}
	opts := []otlptracegrpc.Option{otlptracegrpc.WithEndpointURL(oc.OTLPEndpoint), otlptracegrpc.WithTimeout(10 * time.Second)}
	if len(oc.Headers) > 0 {
		opts = append(opts, otlptracegrpc.WithHeaders(oc.Headers))
	}
	if oc.EnableCompression {
		opts = append(opts, otlptracegrpc.WithCompressor("gzip"))
	}
	return otlptracegrpc.New(ctx, opts...)
}

func newMetricExporter(ctx context.Context, oc config.OpenTelemetryConfig) (sdkmetric.Exporter, error) {
	if isHTTPProtocol(oc.OTLPProtocol) {
		endpoint, err := signalURL(oc.OTLPEndpoint, "/v1/metrics")
		if err != nil {
			return nil, err
		}
		opts := []otlpmetrichttp.Option{otlpmetrichttp.WithEndpointURL(endpoint), otlpmetrichttp.WithTimeout(10 * time.Second)}
		if len(oc.Headers) > 0 {
			opts = append(opts, otlpmetrichttp.WithHeaders(oc.Headers))
		}
		if oc.EnableCompression {
			opts = append(opts, otlpmetrichttp.WithCompression(otlpmetrichttp.GzipCompression))
		}
		return otlpmetrichttp.New(ctx, opts...)
	}
	opts := []otlpmetricgrpc.Option{otlpmetricgrpc.WithEndpointURL(oc.OTLPEndpoint), otlpmetricgrpc.WithTimeout(10 * time.Second)}
	if len(oc.Headers) > 0 {
		opts = append(opts, otlpmetricgrpc.WithHeaders(oc.Headers))
	}
	if oc.EnableCompression {
		opts = append(opts, otlpmetricgrpc.WithCompressor("gzip"))
	}
	return otlpmetricgrpc.New(ctx, opts...)
}
