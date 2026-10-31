package middleware

import (
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/osmait/gestorDePresupuesto/internal/config"
)

// authRouter mounts the unauthenticated auth endpoints behind the rate limiter
// with the limits LoadConfig builds by default.
func authRouter(t *testing.T) *gin.Engine {
	t.Helper()
	t.Setenv("RATE_LIMIT_IP_WHITELIST", "127.0.0.1")
	t.Setenv("JWT_SECRET", "rate-limit-test-secret-at-least-32-characters")
	cfg, err := config.LoadConfig()
	require.NoError(t, err)
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(RateLimitMiddleware(cfg))
	ok := func(c *gin.Context) { c.Status(http.StatusOK) }
	for _, p := range []string{"/auth/login", "/login", "/oauth/authorize", "/user", "/auth/passkey/login/begin", "/auth/passkey/login/finish"} {
		r.POST(p, ok)
	}
	r.GET("/oauth/authorize", ok)
	r.PUT("/user", ok)
	return r
}

func hit(r *gin.Engine, method, path, ip string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, path, nil)
	req.RemoteAddr = ip + ":1234"
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

// Password logins (both REST logins and the MCP OAuth login form) share one
// quota of 10 per minute per IP; the 11th gets 429 + Retry-After.
func TestAuthRateLimits_PasswordLoginsShareOneQuota(t *testing.T) {
	r := authRouter(t)
	const ip = "198.51.100.7"
	paths := []string{"/auth/login", "/login", "/oauth/authorize"}
	for i := 0; i < 10; i++ {
		assert.Equal(t, http.StatusOK, hit(r, http.MethodPost, paths[i%len(paths)], ip).Code, "request %d", i+1)
	}
	for _, p := range paths {
		w := hit(r, http.MethodPost, p, ip)
		assert.Equal(t, http.StatusTooManyRequests, w.Code, p)
		retry, err := strconv.Atoi(w.Header().Get("Retry-After"))
		require.NoError(t, err)
		assert.Equal(t, int(time.Minute.Seconds()), retry)
	}
	// Loading the consent page is not a login attempt.
	assert.Equal(t, http.StatusOK, hit(r, http.MethodGet, "/oauth/authorize", ip).Code)
	// Another IP has its own quota.
	assert.Equal(t, http.StatusOK, hit(r, http.MethodPost, "/auth/login", "198.51.100.8").Code)
}

func TestAuthRateLimits_RegistrationAndPasskeys(t *testing.T) {
	r := authRouter(t)
	const ip = "198.51.100.9"
	for i := 0; i < 5; i++ {
		assert.Equal(t, http.StatusOK, hit(r, http.MethodPost, "/user", ip).Code)
	}
	assert.Equal(t, http.StatusTooManyRequests, hit(r, http.MethodPost, "/user", ip).Code)
	// Only registration (POST) is limited this way, not the profile update.
	assert.Equal(t, http.StatusOK, hit(r, http.MethodPut, "/user", ip).Code)

	for i := 0; i < 20; i++ {
		path := "/auth/passkey/login/begin"
		if i%2 == 1 {
			path = "/auth/passkey/login/finish"
		}
		assert.Equal(t, http.StatusOK, hit(r, http.MethodPost, path, ip).Code, "passkey request %d", i+1)
	}
	assert.Equal(t, http.StatusTooManyRequests, hit(r, http.MethodPost, "/auth/passkey/login/begin", ip).Code)
	// Whitelisted IPs are not limited.
	for i := 0; i < 12; i++ {
		assert.Equal(t, http.StatusOK, hit(r, http.MethodPost, "/auth/login", "127.0.0.1").Code)
	}
}

func TestAuthRateLimits_Configurable(t *testing.T) {
	t.Setenv("RATE_LIMIT_LOGIN_PER_MINUTE", "2")
	t.Setenv("RATE_LIMIT_REGISTER_PER_MINUTE", "0") // falls back to the global limit
	r := authRouter(t)
	const ip = "198.51.100.10"
	assert.Equal(t, http.StatusOK, hit(r, http.MethodPost, "/auth/login", ip).Code)
	assert.Equal(t, http.StatusOK, hit(r, http.MethodPost, "/login", ip).Code)
	assert.Equal(t, http.StatusTooManyRequests, hit(r, http.MethodPost, "/auth/login", ip).Code)
	for i := 0; i < 10; i++ {
		assert.Equal(t, http.StatusOK, hit(r, http.MethodPost, "/user", ip).Code)
	}
}
