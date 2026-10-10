package server

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/osmait/gestorDePresupuesto/internal/config"
	"github.com/osmait/gestorDePresupuesto/internal/platform/telemetry"
)

const testMetricsToken = "test-metrics-token-0123456789"

func metricsTestServer(t *testing.T, enabled bool, token string, port uint) *Server {
	t.Helper()
	gin.SetMode(gin.TestMode)
	cfg := &config.Config{
		Server:        config.ServerConfig{Host: "127.0.0.1", Port: 8080},
		OpenTelemetry: config.OpenTelemetryConfig{ServiceName: "t", ServiceVersion: "0", Environment: "test", SamplingRate: 1},
		Metrics:       config.MetricsConfig{Enabled: enabled, Exporters: []string{"prometheus"}, Token: token, Port: port},
	}
	tel, err := telemetry.Setup(context.Background(), cfg)
	require.NoError(t, err)
	t.Cleanup(func() { _ = tel.Shutdown(context.Background()) })
	s := &Server{Engine: gin.New(), config: cfg, telemetry: tel}
	s.registerMetricsRoute()
	return s
}

func scrape(h http.Handler, auth string) int {
	req := httptest.NewRequest(http.MethodGet, "/metrics", nil)
	if auth != "" {
		req.Header.Set("Authorization", auth)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec.Code
}

func TestMetricsRoute_RequiresToken(t *testing.T) {
	s := metricsTestServer(t, true, testMetricsToken, 0)
	assert.Equal(t, http.StatusUnauthorized, scrape(s.Engine, ""))
	assert.Equal(t, http.StatusUnauthorized, scrape(s.Engine, "Bearer wrong"))
	assert.Equal(t, http.StatusOK, scrape(s.Engine, "Bearer "+testMetricsToken))
	assert.Nil(t, s.metricsServer(), "no separate listener without METRICS_PORT")
}

func TestMetricsRoute_NotMountedWithoutToken(t *testing.T) {
	s := metricsTestServer(t, true, "", 0)
	assert.Equal(t, http.StatusNotFound, scrape(s.Engine, ""))
}

func TestMetricsRoute_NotMountedWhenDisabled(t *testing.T) {
	s := metricsTestServer(t, false, testMetricsToken, 0)
	assert.Equal(t, http.StatusNotFound, scrape(s.Engine, "Bearer "+testMetricsToken))
	assert.Nil(t, s.metricsServer())
}

func TestMetricsRoute_SeparatePort(t *testing.T) {
	s := metricsTestServer(t, true, "", 9464)
	assert.Equal(t, http.StatusNotFound, scrape(s.Engine, ""), "public port must not serve /metrics when METRICS_PORT is set")
	ms := s.metricsServer()
	require.NotNil(t, ms)
	assert.Equal(t, "127.0.0.1:9464", ms.Addr)
	assert.Equal(t, http.StatusOK, scrape(ms.Handler, ""), "internal port without a token is open (private network)")

	s.config.Metrics.Host = "::"
	assert.Equal(t, "[::]:9464", s.metricsServer().Addr, "METRICS_HOST overrides SERVER_HOST")

	withToken := metricsTestServer(t, true, testMetricsToken, 9464).metricsServer()
	assert.Equal(t, http.StatusUnauthorized, scrape(withToken.Handler, ""))
	assert.Equal(t, http.StatusOK, scrape(withToken.Handler, "Bearer "+testMetricsToken))
}
