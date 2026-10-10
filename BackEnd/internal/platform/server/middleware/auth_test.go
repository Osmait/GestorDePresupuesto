package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/osmait/gestorDePresupuesto/internal/config"
	domainUser "github.com/osmait/gestorDePresupuesto/internal/domain/user"
	dto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/user"
	"github.com/osmait/gestorDePresupuesto/internal/platform/utils"
	"github.com/osmait/gestorDePresupuesto/internal/services/errorhttp"
	"github.com/osmait/gestorDePresupuesto/internal/services/user"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestShouldCheckToken covers the exact METHOD+PATH public allow-list.
func TestShouldCheckToken(t *testing.T) {
	tests := []struct {
		method string
		path   string
		public bool
	}{
		// Genuinely public endpoints used by web/iOS without a token.
		{http.MethodPost, "/user", true},
		{http.MethodPost, "/login", true},
		{http.MethodPost, "/auth/login", true},
		{http.MethodPost, "/auth/refresh", true},
		{http.MethodPost, "/auth/logout", true},
		{http.MethodPost, "/auth/demo", true},
		{http.MethodPost, "/auth/passkey/login/begin", true},
		{http.MethodPost, "/auth/passkey/login/finish", true},
		{http.MethodGet, "/health", true},
		{http.MethodHead, "/health", true},
		{http.MethodGet, "/ping", true},
		// /metrics is protected by METRICS_TOKEN (or served on METRICS_PORT), never JWT-public.
		{http.MethodGet, "/metrics", false},
		{http.MethodOptions, "/account", true}, // CORS preflight

		// Regression: GET /user/:id used to be public via a "/user/" prefix match.
		{http.MethodGet, "/user/abc123", false},
		{http.MethodGet, "/user/0df00133-f529-45cb-a195-de05dff00fbc", false},
		{http.MethodGet, "/user", false},
		{http.MethodDelete, "/user/abc123", false},
		{http.MethodPut, "/user", false},

		// Public paths with the wrong method are not public.
		{http.MethodGet, "/auth/login", false},
		{http.MethodPost, "/health", false},

		// Protected resources.
		{http.MethodGet, "/account", false},
		{http.MethodGet, "/profile", false},
		{http.MethodGet, "/notifications", false},
		{http.MethodPost, "/auth/logout-all", false},
		{http.MethodPost, "/auth/passkey/register/begin", false},
		{http.MethodGet, "/users", false},

		// Substring / prefix regressions.
		{http.MethodGet, "/account/login-history", false},
		{http.MethodGet, "/admin/login-audit", false},
		{http.MethodGet, "/users/login-stats", false},
		{http.MethodGet, "/healthcheck-extended", false},
		{http.MethodGet, "/system/healthcheck", false},
		{http.MethodGet, "/admin/ping-log", false},
		{http.MethodGet, "/api/metrics-extended", false},
		{http.MethodPost, "/auth/login/", false},
		{http.MethodPost, "/auth/passkey/login/begin/x", false},
	}

	for _, tc := range tests {
		t.Run(tc.method+" "+tc.path, func(t *testing.T) {
			assert.Equal(t, !tc.public, shouldCheckToken(tc.method, tc.path))
		})
	}
}

// fakeUserRepo is a minimal in-memory UserRepositoryInterface.
type fakeUserRepo struct {
	users map[string]*domainUser.User
}

func (f *fakeUserRepo) FindUserById(_ context.Context, id string) (*domainUser.User, error) {
	if u, ok := f.users[id]; ok {
		return u, nil
	}
	return nil, errorhttp.ErrNotFound
}
func (f *fakeUserRepo) FindUserByEmail(context.Context, string) (*domainUser.User, error) {
	return nil, errorhttp.ErrNotFound
}
func (f *fakeUserRepo) FindUserByIp(context.Context, string) (*domainUser.User, error) {
	return nil, errorhttp.ErrNotFound
}
func (f *fakeUserRepo) DeleteDemoUsersOlderThan(context.Context, time.Time) error { return nil }
func (f *fakeUserRepo) Save(context.Context, *domainUser.User) error              { return nil }
func (f *fakeUserRepo) Delete(context.Context, string) error                      { return nil }
func (f *fakeUserRepo) FindAll(context.Context) ([]*domainUser.User, error)       { return nil, nil }
func (f *fakeUserRepo) FindAllFiltered(context.Context, string, int, int) ([]*domainUser.User, error) {
	return nil, nil
}
func (f *fakeUserRepo) Update(context.Context, *domainUser.User) error { return nil }
func (f *fakeUserRepo) SoftDelete(context.Context, string) error       { return nil }

func authTestConfig() *config.Config {
	return &config.Config{JWT: config.JWTConfig{
		Secret:     "middleware-test-secret-at-least-32-characters",
		Expiration: time.Hour,
		Issuer:     "gestor-test",
		Audience:   "gestor-test-api",
	}}
}

func newAuthRouter(cfg *config.Config) *gin.Engine {
	gin.SetMode(gin.TestMode)
	repo := &fakeUserRepo{users: map[string]*domainUser.User{
		"user-1": {Id: "user-1", Email: "u1@example.com", Role: "USER"},
	}}
	r := gin.New()
	r.Use(AuthMiddleware(user.NewUserService(repo), cfg))
	r.GET("/account", func(c *gin.Context) {
		u, _ := c.Get("User")
		c.JSON(http.StatusOK, gin.H{"id": c.GetString("X-User-Id"), "has_user": u != nil})
	})
	r.POST("/auth/login", func(c *gin.Context) { c.Status(http.StatusNoContent) })
	return r
}

func TestAuthMiddleware(t *testing.T) {
	cfg := authTestConfig()
	r := newAuthRouter(cfg)

	validToken, err := utils.CreateAccessToken("user-1", cfg.JWT)
	require.NoError(t, err)
	unknownUserToken, err := utils.CreateAccessToken("ghost", cfg.JWT)
	require.NoError(t, err)

	otherIssuer := cfg.JWT
	otherIssuer.Issuer = "someone-else"
	wrongIssToken, err := utils.CreateAccessToken("user-1", otherIssuer)
	require.NoError(t, err)

	// A token minted the pre-hardening way (no iss/aud) must be rejected.
	legacy, err := jwt.NewWithClaims(jwt.SigningMethodHS256, utils.AppClaims{
		UserId: "user-1",
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Hour)),
		},
	}).SignedString([]byte(cfg.JWT.Secret))
	require.NoError(t, err)

	tests := []struct {
		name   string
		method string
		path   string
		header string
		status int
	}{
		{"public route needs no token", http.MethodPost, "/auth/login", "", http.StatusNoContent},
		{"missing header", http.MethodGet, "/account", "", http.StatusUnauthorized},
		{"wrong scheme", http.MethodGet, "/account", "Basic abc", http.StatusUnauthorized},
		{"malformed header", http.MethodGet, "/account", "Bearer a b", http.StatusUnauthorized},
		{"garbage token", http.MethodGet, "/account", "Bearer not.a.jwt", http.StatusUnauthorized},
		{"wrong issuer", http.MethodGet, "/account", "Bearer " + *wrongIssToken, http.StatusUnauthorized},
		{"legacy token without iss/aud", http.MethodGet, "/account", "Bearer " + legacy, http.StatusUnauthorized},
		{"unknown user", http.MethodGet, "/account", "Bearer " + *unknownUserToken, http.StatusUnauthorized},
		{"valid token", http.MethodGet, "/account", "Bearer " + *validToken, http.StatusOK},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			w := httptest.NewRecorder()
			req := httptest.NewRequest(tc.method, tc.path, nil)
			if tc.header != "" {
				req.Header.Set("Authorization", tc.header)
			}
			r.ServeHTTP(w, req)
			assert.Equal(t, tc.status, w.Code, w.Body.String())
			if tc.status == http.StatusOK {
				assert.JSONEq(t, `{"id":"user-1","has_user":true}`, w.Body.String())
			}
		})
	}
}

func TestRequireRole(t *testing.T) {
	tests := []struct {
		name   string
		user   any
		status int
	}{
		{"no user in context", nil, http.StatusUnauthorized},
		{"wrong context type", "not-a-user", http.StatusInternalServerError},
		{"insufficient role", &dto.UserResponse{Role: "USER"}, http.StatusForbidden},
		{"admin allowed", &dto.UserResponse{Role: "ADMIN"}, http.StatusOK},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			gin.SetMode(gin.TestMode)
			r := gin.New()
			r.Use(func(c *gin.Context) {
				if tc.user != nil {
					c.Set("User", tc.user)
				}
			})
			r.GET("/admin", RequireRole("ADMIN"), func(c *gin.Context) { c.Status(http.StatusOK) })
			w := httptest.NewRecorder()
			r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/admin", nil))
			assert.Equal(t, tc.status, w.Code)
		})
	}
}
