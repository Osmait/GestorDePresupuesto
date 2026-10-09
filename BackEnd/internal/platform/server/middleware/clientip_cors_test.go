package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/osmait/gestorDePresupuesto/internal/config"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newClientIPRouter(t *testing.T, srv config.ServerConfig) *gin.Engine {
	t.Helper()
	gin.SetMode(gin.TestMode)
	r := gin.New()
	require.NoError(t, ConfigureClientIP(r, srv))
	r.GET("/ip", func(c *gin.Context) { c.String(http.StatusOK, c.ClientIP()) })
	return r
}

func TestConfigureClientIP(t *testing.T) {
	tests := []struct {
		name       string
		srv        config.ServerConfig
		remoteAddr string
		headers    map[string]string
		want       string
	}{
		{
			name:       "default trusts nobody: spoofed XFF ignored",
			remoteAddr: "203.0.113.7:4444",
			headers:    map[string]string{"X-Forwarded-For": "127.0.0.1"},
			want:       "203.0.113.7",
		},
		{
			name:       "default trusts nobody: spoofed X-Real-IP ignored",
			remoteAddr: "203.0.113.7:4444",
			headers:    map[string]string{"X-Real-IP": "10.1.1.1"},
			want:       "203.0.113.7",
		},
		{
			name:       "trusted proxy: client IP taken from XFF",
			srv:        config.ServerConfig{TrustedProxies: []string{"100.64.0.0/10"}},
			remoteAddr: "100.64.1.2:4444",
			headers:    map[string]string{"X-Forwarded-For": "198.51.100.9"},
			want:       "198.51.100.9",
		},
		{
			name:       "trusted proxy: client-supplied left entries skipped",
			srv:        config.ServerConfig{TrustedProxies: []string{"100.64.0.0/10"}},
			remoteAddr: "100.64.1.2:4444",
			headers:    map[string]string{"X-Forwarded-For": "127.0.0.1, 198.51.100.9"},
			want:       "198.51.100.9",
		},
		{
			name:       "untrusted peer cannot use XFF even with proxies configured",
			srv:        config.ServerConfig{TrustedProxies: []string{"100.64.0.0/10"}},
			remoteAddr: "203.0.113.7:4444",
			headers:    map[string]string{"X-Forwarded-For": "127.0.0.1"},
			want:       "203.0.113.7",
		},
		{
			name:       "platform header trusted",
			srv:        config.ServerConfig{TrustedPlatformHeader: "X-Real-IP"},
			remoteAddr: "100.64.1.2:4444",
			headers:    map[string]string{"X-Real-IP": "198.51.100.9", "X-Forwarded-For": "127.0.0.1"},
			want:       "198.51.100.9",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			r := newClientIPRouter(t, tc.srv)
			req := httptest.NewRequest(http.MethodGet, "/ip", nil)
			req.RemoteAddr = tc.remoteAddr
			for k, v := range tc.headers {
				req.Header.Set(k, v)
			}
			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)
			assert.Equal(t, tc.want, w.Body.String())
		})
	}
}

func TestConfigureClientIP_InvalidProxy(t *testing.T) {
	r := gin.New()
	assert.Error(t, ConfigureClientIP(r, config.ServerConfig{TrustedProxies: []string{"nope"}}))
}

// TestRateLimit_SpoofedXFFCannotBypass is the regression for the whitelist
// bypass: "X-Forwarded-For: 127.0.0.1" matched the default 127.0.0.1
// whitelist (and rotating XFF values gave a fresh quota per request).
func TestRateLimit_SpoofedXFFCannotBypass(t *testing.T) {
	cfg := &config.Config{
		RateLimit: config.RateLimitConfig{
			Enabled:     true,
			Requests:    2,
			Window:      time.Minute,
			IPWhitelist: []string{"127.0.0.1", "::1"},
		},
	}
	gin.SetMode(gin.TestMode)
	r := gin.New()
	require.NoError(t, ConfigureClientIP(r, cfg.Server))
	r.Use(RateLimitMiddleware(cfg))
	r.GET("/test", func(c *gin.Context) { c.Status(http.StatusOK) })

	spoofed := []string{"127.0.0.1", "1.1.1.1", "2.2.2.2", "::1"}
	codes := make([]int, 0, len(spoofed))
	for _, xff := range spoofed {
		req := httptest.NewRequest(http.MethodGet, "/test", nil)
		req.RemoteAddr = "203.0.113.7:5555"
		req.Header.Set("X-Forwarded-For", xff)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		codes = append(codes, w.Code)
	}
	assert.Equal(t, []int{200, 200, 429, 429}, codes)
}

func TestRateLimit_RetryAfterHeader(t *testing.T) {
	cfg := &config.Config{RateLimit: config.RateLimitConfig{Enabled: true, Requests: 1, Window: time.Minute}}
	r := setupRouter(cfg)

	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/test", nil))
	assert.Equal(t, http.StatusOK, w.Code)
	assert.Equal(t, "0", w.Header().Get("X-RateLimit-Remaining"))

	w = httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/test", nil))
	assert.Equal(t, http.StatusTooManyRequests, w.Code)
	assert.Equal(t, "60", w.Header().Get("Retry-After"))
}

func TestRateLimit_Disabled(t *testing.T) {
	cfg := &config.Config{RateLimit: config.RateLimitConfig{Enabled: false, Requests: 0, Window: time.Minute}}
	r := setupRouter(cfg)
	for i := 0; i < 3; i++ {
		w := httptest.NewRecorder()
		r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/test", nil))
		assert.Equal(t, http.StatusOK, w.Code)
	}
}

func TestRateLimit_UserBasedKey(t *testing.T) {
	cfg := &config.Config{RateLimit: config.RateLimitConfig{
		Enabled: true, Requests: 1, Window: time.Minute, UserBased: true,
	}}
	svc := NewRateLimitService(cfg)
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(func(c *gin.Context) {
		if u := c.GetHeader("X-Test-User"); u != "" {
			c.Set("X-User-Id", u)
		}
	})
	r.Use(svc.Middleware())
	r.GET("/test", func(c *gin.Context) { c.Status(http.StatusOK) })

	do := func(user string) int {
		req := httptest.NewRequest(http.MethodGet, "/test", nil)
		req.Header.Set("X-Test-User", user)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		return w.Code
	}
	assert.Equal(t, http.StatusOK, do("alice"))
	assert.Equal(t, http.StatusOK, do("bob"), "separate quota per user from the same IP")
	assert.Equal(t, http.StatusTooManyRequests, do("alice"))
}

func TestRateLimitCleanup_EvictsExpiredKeysPerWindow(t *testing.T) {
	cfg := &config.Config{RateLimit: config.RateLimitConfig{
		Enabled: true, Requests: 10, Window: time.Minute,
	}}
	svc := NewRateLimitService(cfg)
	now := time.Now()
	svc.now = func() time.Time { return now }

	assert.True(t, svc.IsAllowed("ip:1.1.1.1", 10, time.Minute, 0))
	assert.True(t, svc.IsAllowed("ip:2.2.2.2:/auth/demo", 5, time.Hour, 0))
	assert.Equal(t, 2, svc.size())

	// 2 minutes later: the 1-minute key expires, the 1-hour key must survive
	// (otherwise cleanup would reset the strict /auth/demo quota).
	now = now.Add(2 * time.Minute)
	svc.cleanup()
	assert.Equal(t, 1, svc.size())

	now = now.Add(2 * time.Hour)
	svc.cleanup()
	assert.Equal(t, 0, svc.size())
}

func TestRateLimitStartCleanup_StopsOnContextCancel(t *testing.T) {
	cfg := &config.Config{RateLimit: config.RateLimitConfig{Enabled: true, Requests: 10, Window: time.Minute}}
	svc := NewRateLimitService(cfg)
	start := time.Now()
	current := start
	svc.now = func() time.Time { return current }
	assert.True(t, svc.IsAllowed("k", 10, time.Millisecond, 0))
	current = start.Add(time.Second)

	ctx, cancel := context.WithCancel(context.Background())
	done := svc.StartCleanup(ctx, 5*time.Millisecond)

	assert.Eventually(t, func() bool { return svc.size() == 0 }, time.Second, 5*time.Millisecond)
	cancel()
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("cleanup goroutine did not stop after context cancel")
	}
}

func TestCORS(t *testing.T) {
	cfg := config.CORSConfig{
		AllowedOrigins: []string{"https://app.example.com", "http://localhost:3000"},
		AllowedMethods: []string{"GET", "POST", "OPTIONS"},
		AllowedHeaders: []string{"Authorization", "Content-Type"},
		ExposedHeaders: []string{"X-Request-ID"},
		MaxAge:         600,
	}
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(CORS(cfg))
	r.GET("/data", func(c *gin.Context) { c.String(http.StatusOK, "ok") })

	tests := []struct {
		name        string
		method      string
		origin      string
		preflight   bool
		wantAllowed bool
	}{
		{"allowed origin simple request", http.MethodGet, "https://app.example.com", false, true},
		{"allowed dev origin", http.MethodGet, "http://localhost:3000", false, true},
		{"foreign origin rejected", http.MethodGet, "https://evil.example.com", false, false},
		{"lookalike origin rejected", http.MethodGet, "https://app.example.com.evil.io", false, false},
		{"allowed preflight", http.MethodOptions, "https://app.example.com", true, true},
		{"foreign preflight rejected", http.MethodOptions, "https://evil.example.com", true, false},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(tc.method, "/data", nil)
			req.Header.Set("Origin", tc.origin)
			if tc.preflight {
				req.Header.Set("Access-Control-Request-Method", "POST")
				req.Header.Set("Access-Control-Request-Headers", "Authorization")
			}
			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)

			got := w.Header().Get("Access-Control-Allow-Origin")
			if tc.wantAllowed {
				assert.Equal(t, tc.origin, got)
			} else {
				assert.Empty(t, got)
			}
			assert.Empty(t, w.Header().Get("Access-Control-Allow-Credentials"),
				"credentials must not be allowed for a bearer-token API")
		})
	}
}

func TestClearConnDeadlines_RealServer(t *testing.T) {
	// A WriteTimeout shorter than the stream: without clearing the deadline
	// the second chunk would never reach the client.
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.GET("/stream", StreamingNoDeadline(), func(c *gin.Context) {
		c.Header("Content-Type", "text/event-stream")
		c.String(http.StatusOK, "data: first\n\n")
		c.Writer.Flush()
		time.Sleep(300 * time.Millisecond)
		c.String(http.StatusOK, "data: second\n\n")
		c.Writer.Flush()
	})

	ts := httptest.NewUnstartedServer(r)
	ts.Config.WriteTimeout = 100 * time.Millisecond
	ts.Config.ReadTimeout = 100 * time.Millisecond
	ts.Start()
	defer ts.Close()

	resp, err := http.Get(ts.URL + "/stream")
	require.NoError(t, err)
	defer func() { _ = resp.Body.Close() }()
	body := make([]byte, 0, 64)
	buf := make([]byte, 64)
	for {
		n, readErr := resp.Body.Read(buf)
		body = append(body, buf[:n]...)
		if readErr != nil {
			break
		}
	}
	assert.Contains(t, string(body), "data: second")
}
