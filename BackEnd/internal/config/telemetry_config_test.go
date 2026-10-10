package config

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestLoadConfig_TelemetryOffByDefault(t *testing.T) {
	t.Setenv("ENV", "production")
	t.Setenv("JWT_SECRET", "a-production-secret-that-is-long-enough-123")
	t.Setenv("CORS_ALLOWED_ORIGINS", "https://app.example.com")

	cfg, err := LoadConfig()
	require.NoError(t, err)
	assert.False(t, cfg.FeatureFlags.EnableTracing, "tracing must be opt-in")
	assert.False(t, cfg.Metrics.Enabled, "metrics must be opt-in")
	assert.Equal(t, "errors", cfg.Logging.AccessLog, "production access log only records errors/slow requests by default")
	assert.Equal(t, "production", cfg.OpenTelemetry.Environment, "deployment env defaults to ENV")
	assert.Equal(t, "grpc", cfg.OpenTelemetry.OTLPProtocol)
}

func TestLoadConfig_StandardOTLPVariables(t *testing.T) {
	t.Setenv("ENV", "development")
	t.Setenv("ENABLE_TRACING", "true")
	t.Setenv("METRICS_ENABLED", "true")
	t.Setenv("METRICS_EXPORTER", "prometheus, otlp")
	t.Setenv("OTEL_OTLP_ENDPOINT", "http://legacy:4317")
	t.Setenv("OTEL_EXPORTER_OTLP_ENDPOINT", "https://otlp-gateway.example.net/otlp")
	t.Setenv("OTEL_EXPORTER_OTLP_PROTOCOL", "http/protobuf")
	t.Setenv("OTEL_EXPORTER_OTLP_HEADERS", "x-scope=team%20a,x-tenant=a")

	cfg, err := LoadConfig()
	require.NoError(t, err)
	assert.True(t, cfg.FeatureFlags.EnableTracing)
	assert.True(t, cfg.Metrics.Enabled)
	assert.True(t, cfg.Metrics.HasExporter("prometheus"))
	assert.True(t, cfg.Metrics.HasExporter("otlp"))
	assert.Equal(t, "https://otlp-gateway.example.net/otlp", cfg.OpenTelemetry.OTLPEndpoint, "standard variable wins")
	assert.Equal(t, "http/protobuf", cfg.OpenTelemetry.OTLPProtocol)
	assert.Equal(t, "team a", cfg.OpenTelemetry.Headers["x-scope"], "header values are URL-decoded")
	assert.Equal(t, "all", cfg.Logging.AccessLog)
}

func TestValidateMetrics(t *testing.T) {
	valid := func() *Config {
		return &Config{
			Server:        ServerConfig{Port: 8080, Environment: EnvironmentProduction},
			OpenTelemetry: OpenTelemetryConfig{OTLPEndpoint: "http://collector:4317"},
			Logging:       LoggingConfig{AccessLog: "errors", AccessLogSampleRate: 1},
			Metrics:       MetricsConfig{Enabled: true, Exporters: []string{"prometheus"}, Token: "0123456789abcdef0123"},
		}
	}
	cases := []struct {
		name    string
		mutate  func(c *Config)
		wantErr string
	}{
		{"token protected", func(*Config) {}, ""},
		{"internal port without token", func(c *Config) { c.Metrics.Token = ""; c.Metrics.Port = 9464 }, ""},
		{"public unauthenticated in production", func(c *Config) { c.Metrics.Token = "" }, "requires METRICS_TOKEN or METRICS_PORT"},
		{"public unauthenticated in development is allowed (not mounted)", func(c *Config) {
			c.Metrics.Token = ""
			c.Server.Environment = EnvironmentDevelopment
		}, ""},
		{"short token", func(c *Config) { c.Metrics.Token = "short" }, "at least 16"},
		{"same port as API", func(c *Config) { c.Metrics.Port = 8080 }, "must differ"},
		{"unknown exporter", func(c *Config) { c.Metrics.Exporters = []string{"statsd"} }, "invalid METRICS_EXPORTER"},
		{"otlp without endpoint", func(c *Config) {
			c.Metrics.Exporters = []string{"otlp"}
			c.OpenTelemetry.OTLPEndpoint = ""
		}, "requires OTEL_EXPORTER_OTLP_ENDPOINT"},
		{"bad access log mode", func(c *Config) { c.Logging.AccessLog = "verbose" }, "invalid ACCESS_LOG"},
		{"bad sample rate", func(c *Config) { c.Logging.AccessLogSampleRate = 2 }, "ACCESS_LOG_SAMPLE_RATE"},
		{"disabled skips exporter checks", func(c *Config) {
			c.Metrics.Enabled = false
			c.Metrics.Token = ""
			c.Metrics.Exporters = nil
		}, ""},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			c := valid()
			tc.mutate(c)
			err := c.validateMetrics()
			if tc.wantErr == "" {
				assert.NoError(t, err)
				return
			}
			require.Error(t, err)
			assert.Contains(t, err.Error(), tc.wantErr)
		})
	}
}
