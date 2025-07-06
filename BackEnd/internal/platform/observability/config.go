package observability

import (
	"context"
	"fmt"
	"os"
	"strconv"
	"time"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	"go.opentelemetry.io/otel/exporters/prometheus"
	"go.opentelemetry.io/otel/exporters/stdout/stdouttrace"
	"go.opentelemetry.io/otel/metric"
	"go.opentelemetry.io/otel/propagation"
	sdkmetric "go.opentelemetry.io/otel/sdk/metric"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.26.0"
	"go.opentelemetry.io/otel/trace"
)

// Config holds OpenTelemetry configuration
type Config struct {
	ServiceName        string
	ServiceVersion     string
	Environment        string
	JaegerEndpoint     string
	OTLPEndpoint       string
	EnableStdout       bool
	EnableMetrics      bool
	EnableTracing      bool
	SamplingRate       float64
	MetricInterval     time.Duration
	BatchTimeout       time.Duration
	MaxBatchSize       int
	MaxQueueSize       int
	PrometheusEndpoint string
}

// NewConfig creates a new OpenTelemetry configuration from environment variables
func NewConfig() *Config {
	return &Config{
		ServiceName:        getEnv("OTEL_SERVICE_NAME", "gestor-de-presupuesto"),
		ServiceVersion:     getEnv("OTEL_SERVICE_VERSION", "1.0.0"),
		Environment:        getEnv("OTEL_ENVIRONMENT", "development"),
		JaegerEndpoint:     getEnv("JAEGER_ENDPOINT", ""),
		OTLPEndpoint:       getEnv("OTEL_EXPORTER_OTLP_ENDPOINT", "http://localhost:4318"),
		EnableStdout:       getEnv("OTEL_ENABLE_STDOUT", "false") == "true",
		EnableMetrics:      getEnv("OTEL_ENABLE_METRICS", "true") == "true",
		EnableTracing:      getEnv("OTEL_ENABLE_TRACING", "true") == "true",
		SamplingRate:       getEnvFloat("OTEL_SAMPLING_RATE", 1.0),
		MetricInterval:     getEnvDuration("OTEL_METRIC_INTERVAL", 30*time.Second),
		BatchTimeout:       getEnvDuration("OTEL_BATCH_TIMEOUT", 5*time.Second),
		MaxBatchSize:       getEnvInt("OTEL_MAX_BATCH_SIZE", 512),
		MaxQueueSize:       getEnvInt("OTEL_MAX_QUEUE_SIZE", 2048),
		PrometheusEndpoint: getEnv("PROMETHEUS_ENDPOINT", ":2112"),
	}
}

// Provider holds OpenTelemetry providers
type Provider struct {
	TracerProvider trace.TracerProvider
	MeterProvider  metric.MeterProvider
	Tracer         trace.Tracer
	Meter          metric.Meter
	resource       *resource.Resource
	shutdownFuncs  []func(context.Context) error
}

// NewProvider creates and configures OpenTelemetry providers
func NewProvider(cfg *Config) (*Provider, error) {
	res, err := newResource(cfg)
	if err != nil {
		return nil, fmt.Errorf("failed to create resource: %w", err)
	}

	p := &Provider{
		resource:      res,
		shutdownFuncs: make([]func(context.Context) error, 0),
	}

	// Setup tracing if enabled
	if cfg.EnableTracing {
		tp, err := p.setupTracing(cfg, res)
		if err != nil {
			return nil, fmt.Errorf("failed to setup tracing: %w", err)
		}
		p.TracerProvider = tp
		p.Tracer = tp.Tracer(cfg.ServiceName)
		otel.SetTracerProvider(tp)
	}

	// Setup metrics if enabled
	if cfg.EnableMetrics {
		mp, err := p.setupMetrics(cfg, res)
		if err != nil {
			return nil, fmt.Errorf("failed to setup metrics: %w", err)
		}
		p.MeterProvider = mp
		p.Meter = mp.Meter(cfg.ServiceName)
		otel.SetMeterProvider(mp)
	}

	// Setup propagators
	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(
		propagation.TraceContext{},
		propagation.Baggage{},
	))

	return p, nil
}

// setupTracing configures the tracing provider
func (p *Provider) setupTracing(cfg *Config, res *resource.Resource) (trace.TracerProvider, error) {
	var exporters []sdktrace.SpanExporter

	// Add OTLP exporter if endpoint is configured
	if cfg.OTLPEndpoint != "" {
		otlpExporter, err := otlptracehttp.New(
			context.Background(),
			otlptracehttp.WithEndpoint(cfg.OTLPEndpoint),
			otlptracehttp.WithInsecure(),
		)
		if err != nil {
			return nil, fmt.Errorf("failed to create OTLP exporter: %w", err)
		}
		exporters = append(exporters, otlpExporter)
		p.shutdownFuncs = append(p.shutdownFuncs, otlpExporter.Shutdown)
	}

	// Add stdout exporter if enabled
	if cfg.EnableStdout {
		stdoutExporter, err := stdouttrace.New(
			stdouttrace.WithPrettyPrint(),
		)
		if err != nil {
			return nil, fmt.Errorf("failed to create stdout exporter: %w", err)
		}
		exporters = append(exporters, stdoutExporter)
		p.shutdownFuncs = append(p.shutdownFuncs, stdoutExporter.Shutdown)
	}

	// Configure batch span processor options
	var batchOptions []sdktrace.BatchSpanProcessorOption
	if cfg.BatchTimeout > 0 {
		batchOptions = append(batchOptions, sdktrace.WithBatchTimeout(cfg.BatchTimeout))
	}
	if cfg.MaxBatchSize > 0 {
		batchOptions = append(batchOptions, sdktrace.WithMaxExportBatchSize(cfg.MaxBatchSize))
	}
	if cfg.MaxQueueSize > 0 {
		batchOptions = append(batchOptions, sdktrace.WithMaxQueueSize(cfg.MaxQueueSize))
	}

	// Create trace provider with batch processors
	var processors []sdktrace.SpanProcessor
	for _, exporter := range exporters {
		processor := sdktrace.NewBatchSpanProcessor(exporter, batchOptions...)
		processors = append(processors, processor)
	}

	// Configure sampler
	var sampler sdktrace.Sampler
	if cfg.SamplingRate <= 0 {
		sampler = sdktrace.NeverSample()
	} else if cfg.SamplingRate >= 1.0 {
		sampler = sdktrace.AlwaysSample()
	} else {
		sampler = sdktrace.TraceIDRatioBased(cfg.SamplingRate)
	}

	tp := sdktrace.NewTracerProvider(
		sdktrace.WithResource(res),
		sdktrace.WithSampler(sampler),
	)

	// Add processors
	for _, processor := range processors {
		tp.RegisterSpanProcessor(processor)
	}

	p.shutdownFuncs = append(p.shutdownFuncs, tp.Shutdown)

	return tp, nil
}

// setupMetrics configures the metrics provider
func (p *Provider) setupMetrics(cfg *Config, res *resource.Resource) (metric.MeterProvider, error) {
	// Create Prometheus exporter
	promExporter, err := prometheus.New()
	if err != nil {
		return nil, fmt.Errorf("failed to create Prometheus exporter: %w", err)
	}

	// Create metrics provider
	mp := sdkmetric.NewMeterProvider(
		sdkmetric.WithResource(res),
		sdkmetric.WithReader(promExporter),
	)

	p.shutdownFuncs = append(p.shutdownFuncs, mp.Shutdown)

	return mp, nil
}

// newResource creates a new resource for OpenTelemetry
func newResource(cfg *Config) (*resource.Resource, error) {
	return resource.Merge(
		resource.Default(),
		resource.NewWithAttributes(
			semconv.SchemaURL,
			semconv.ServiceName(cfg.ServiceName),
			semconv.ServiceVersion(cfg.ServiceVersion),
			semconv.DeploymentEnvironment(cfg.Environment),
		),
	)
}

// Shutdown gracefully shuts down all providers
func (p *Provider) Shutdown(ctx context.Context) error {
	var errors []error

	for _, shutdown := range p.shutdownFuncs {
		if err := shutdown(ctx); err != nil {
			errors = append(errors, err)
		}
	}

	if len(errors) > 0 {
		return fmt.Errorf("shutdown errors: %v", errors)
	}

	return nil
}

// Helper functions for environment variable parsing
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvFloat(key string, defaultValue float64) float64 {
	if value := os.Getenv(key); value != "" {
		if f, err := strconv.ParseFloat(value, 64); err == nil {
			return f
		}
	}
	return defaultValue
}

func getEnvDuration(key string, defaultValue time.Duration) time.Duration {
	if value := os.Getenv(key); value != "" {
		if d, err := time.ParseDuration(value); err == nil {
			return d
		}
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if i, err := strconv.Atoi(value); err == nil {
			return i
		}
	}
	return defaultValue
}
