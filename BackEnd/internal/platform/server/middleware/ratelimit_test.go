package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/osmait/gestorDePresupuesto/internal/config"
	"github.com/stretchr/testify/assert"
)

func setupRouter(cfg *config.Config) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(RateLimitMiddleware(cfg))
	r.GET("/test", func(c *gin.Context) {
		c.Status(http.StatusOK)
	})
	r.GET("/api/auth/login", func(c *gin.Context) {
		c.Status(http.StatusOK)
	})
	r.GET("/api/data", func(c *gin.Context) {
		c.Status(http.StatusOK)
	})
	return r
}

func TestRateLimit_Global(t *testing.T) {
	cfg := &config.Config{
		RateLimit: config.RateLimitConfig{
			Enabled:  true,
			Requests: 2,
			Window:   time.Minute,
			Burst:    0,
		},
	}

	r := setupRouter(cfg)

	// First request - OK
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/test", nil)
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)

	// Second request - OK
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("GET", "/test", nil)
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)

	// Third request - Blocked
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("GET", "/test", nil)
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusTooManyRequests, w.Code)
}

func TestRateLimit_Bursts(t *testing.T) {
	cfg := &config.Config{
		RateLimit: config.RateLimitConfig{
			Enabled:  true,
			Requests: 1,
			Window:   time.Minute,
			Burst:    1,
		},
	}

	r := setupRouter(cfg)

	// 1 (Limit) + 1 (Burst) = 2 Requests allowed

	// 1. Initial
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest("GET", "/test", nil))
	assert.Equal(t, http.StatusOK, w.Code)

	// 2. Burst
	w = httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest("GET", "/test", nil))
	assert.Equal(t, http.StatusOK, w.Code)

	// 3. Blocked
	w = httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest("GET", "/test", nil))
	assert.Equal(t, http.StatusTooManyRequests, w.Code)
}

func TestRateLimit_PerEndpoint(t *testing.T) {
	cfg := &config.Config{
		RateLimit: config.RateLimitConfig{
			Enabled:  true,
			Requests: 10, // Global is high
			Window:   time.Minute,
			Endpoints: []config.EndpointRateLimitConfig{
				{
					Path:     "/api/auth/login",
					Requests: 1,
					Window:   time.Minute,
				},
			},
		},
	}

	r := setupRouter(cfg)

	// Endpoint specific limit (1 req)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest("GET", "/api/auth/login", nil))
	assert.Equal(t, http.StatusOK, w.Code)

	w = httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest("GET", "/api/auth/login", nil))
	assert.Equal(t, http.StatusTooManyRequests, w.Code)

	// Other endpoint should use global limit (10 req)
	w = httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest("GET", "/test", nil))
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestRateLimit_IPWhitelist_CIDR(t *testing.T) {
	cfg := &config.Config{
		RateLimit: config.RateLimitConfig{
			Enabled:     true,
			Requests:    0, // Block everything unless whitelisted
			Window:      time.Minute,
			IPWhitelist: []string{"192.168.1.0/24"},
		},
	}

	r := setupRouter(cfg)

	// Whitelisted IP in CIDR
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/test", nil)
	req.RemoteAddr = "192.168.1.100:1234" // Simulate Client IP
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)

	// Non-whitelisted IP
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("GET", "/test", nil)
	req.RemoteAddr = "10.0.0.1:1234"
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusTooManyRequests, w.Code)
}

func TestRateLimit_IPWhitelist_Exact(t *testing.T) {
	cfg := &config.Config{
		RateLimit: config.RateLimitConfig{
			Enabled:     true,
			Requests:    0,
			Window:      time.Minute,
			IPWhitelist: []string{"1.2.3.4"},
		},
	}

	r := setupRouter(cfg)

	// Whitelisted IP
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/test", nil)
	req.RemoteAddr = "1.2.3.4:1234"
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusOK, w.Code)

	// Non-whitelisted IP
	w = httptest.NewRecorder()
	req, _ = http.NewRequest("GET", "/test", nil)
	req.RemoteAddr = "1.2.3.5:1234"
	r.ServeHTTP(w, req)
	assert.Equal(t, http.StatusTooManyRequests, w.Code)
}
