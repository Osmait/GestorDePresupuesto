package middleware

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

// TestShouldCheckToken_PublicRoutes verifies that every explicitly-listed
// public route bypasses authentication.
func TestShouldCheckToken_PublicRoutes(t *testing.T) {
	publicPaths := []string{
		"/login",
		"/auth/login",
		"/auth/refresh",
		"/auth/logout",
		"/auth/demo",
		"/health",
		"/ping",
		"/metrics",
	}

	for _, path := range publicPaths {
		t.Run(path, func(t *testing.T) {
			assert.False(t, shouldCheckToken(path),
				"expected %q to bypass auth (public route)", path)
		})
	}
}

// TestShouldCheckToken_UserRegistrationRoutes verifies that /user and
// /user/:id are public (registration + lookup).
func TestShouldCheckToken_UserRegistrationRoutes(t *testing.T) {
	cases := []string{
		"/user",
		"/user/abc123",
		"/user/0df00133-f529-45cb-a195-de05dff00fbc",
	}
	for _, path := range cases {
		t.Run(path, func(t *testing.T) {
			assert.False(t, shouldCheckToken(path),
				"expected %q to bypass auth (user registration)", path)
		})
	}
}

// TestShouldCheckToken_ProtectedRoutes verifies that all other routes
// require a valid JWT.
func TestShouldCheckToken_ProtectedRoutes(t *testing.T) {
	protected := []string{
		"/account",
		"/transaction",
		"/category",
		"/budget",
		"/profile",
		"/notifications",
		"/notifications/history",
		"/invesment",
		"/auth/logout-all",
		// Paths that CONTAIN "login" as a substring — must NOT bypass auth.
		// This is the regression for the old strings.Contains vulnerability.
		"/account/login-history",
		"/admin/login-audit",
		"/users/login-stats",
		"/healthcheck-extended", // contains "health" substring
		"/api/metrics-extended", // contains "metrics" substring
	}

	for _, path := range protected {
		t.Run(path, func(t *testing.T) {
			assert.True(t, shouldCheckToken(path),
				"expected %q to require auth (protected route)", path)
		})
	}
}

// TestShouldCheckToken_SubstringRegressionLogin is an explicit regression
// test for the old bug: "login" was checked with strings.Contains, meaning
// any route whose path contained "login" would accidentally bypass auth.
func TestShouldCheckToken_SubstringRegressionLogin(t *testing.T) {
	dangerouspaths := []string{
		"/account/login-history",
		"/admin/logins",
		"/users/last-login",
		"/report/login-attempts",
	}

	for _, path := range dangerouspaths {
		t.Run("must_require_auth/"+path, func(t *testing.T) {
			assert.True(t, shouldCheckToken(path),
				"SECURITY: %q contains 'login' as substring but must still require auth", path)
		})
	}
}

// TestShouldCheckToken_SubstringRegressionOthers covers the other former
// substring matches: "health", "ping", "metrics".
func TestShouldCheckToken_SubstringRegressionOthers(t *testing.T) {
	cases := []struct {
		path    string
		keyword string
	}{
		{"/system/healthcheck", "health"},
		{"/admin/ping-log", "ping"},
		{"/internal/metrics-raw", "metrics"},
	}

	for _, tc := range cases {
		t.Run(tc.path, func(t *testing.T) {
			assert.True(t, shouldCheckToken(tc.path),
				"SECURITY: %q contains %q as substring but must still require auth", tc.path, tc.keyword)
		})
	}
}
