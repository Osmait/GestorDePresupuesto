package middleware

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/osmait/gestorDePresupuesto/internal/config"
	dto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/user"
	apperrors "github.com/osmait/gestorDePresupuesto/internal/platform/errors"
	"github.com/osmait/gestorDePresupuesto/internal/platform/utils"
	"github.com/osmait/gestorDePresupuesto/internal/services/user"
)

// publicRoutes is the authoritative set of METHOD + PATH pairs that bypass
// authentication. These are exactly the endpoints the web and iOS clients
// call without a bearer token.
//
// IMPORTANT: exact matches only. Prefix/substring matching is a security
// risk — e.g. "/user/*" once exposed GET /user/:id (any user's profile) to
// anonymous callers, and a substring match on "login" would expose
// "/account/login-history".
var publicRoutes = map[string]bool{
	http.MethodPost + " /user":                      true, // registration
	http.MethodPost + " /login":                     true, // legacy single-token login
	http.MethodPost + " /auth/login":                true,
	http.MethodPost + " /auth/refresh":              true,
	http.MethodPost + " /auth/logout":               true, // authenticated by the refresh token in the body
	http.MethodPost + " /auth/demo":                 true,
	http.MethodPost + " /auth/passkey/login/begin":  true,
	http.MethodPost + " /auth/passkey/login/finish": true,
	http.MethodGet + " /health":                     true,
	http.MethodGet + " /ping":                       true,
	http.MethodHead + " /health":                    true,
}

// shouldCheckToken reports whether a request with the given method and path
// requires a valid JWT. CORS preflights (OPTIONS) never carry credentials and
// are answered by the CORS middleware, so they are not authenticated.
func shouldCheckToken(method, route string) bool {
	if method == http.MethodOptions {
		return false
	}
	return !publicRoutes[method+" "+route]
}

// AuthMiddleware provides JWT-based authentication. Tokens must be HS256,
// unexpired, and carry the configured issuer and audience.
func AuthMiddleware(userService *user.UserService, cfg *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Skip authentication for public routes
		if !shouldCheckToken(c.Request.Method, c.Request.URL.Path) {
			c.Next()
			return
		}

		// Extract Authorization header
		authHeader := strings.TrimSpace(c.GetHeader("Authorization"))
		if authHeader == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "authorization header is required",
			})
			return
		}

		// Validate Authorization header format
		tokenParts := strings.Split(authHeader, " ")
		if len(tokenParts) != 2 || tokenParts[0] != "Bearer" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "invalid authorization header format",
			})
			return
		}

		claims, err := utils.ParseAccessToken(tokenParts[1], cfg.JWT)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "invalid or expired token",
			})
			return
		}

		// Validate user exists and is active. This runs before RLSMiddleware,
		// so it holds no other pooled connection; it is the most frequent query
		// of the API, hence the short-TTL cache (AUTH_USER_CACHE_TTL), and its
		// wait is bounded like the request transaction (DB_TX_ACQUIRE_TIMEOUT)
		// so pool exhaustion fails fast instead of queueing every request.
		lookupCtx := c.Request.Context()
		if timeout := cfg.Database.TxAcquireTimeout; timeout > 0 {
			var cancel context.CancelFunc
			lookupCtx, cancel = context.WithTimeout(lookupCtx, timeout)
			defer cancel()
		}
		u, err := userService.FindActiveUserForAuth(lookupCtx, claims.UserId)
		if err != nil && isTransientLookupError(err) {
			// A database outage or an exhausted pool is not a reason to log
			// the user out: answer 503 so clients retry instead.
			c.Header("Retry-After", "1")
			c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{
				"error": "authentication temporarily unavailable, please retry",
			})
			return
		}
		if err != nil || u == nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"error": "user not found or inactive",
			})
			return
		}

		// Set user context for downstream handlers
		c.Set("X-User-Id", claims.UserId)
		c.Set("User", u)
		c.Next()
	}
}

// isTransientLookupError reports whether a user lookup failed because of the
// database (unavailable, pool exhausted, timeout) rather than because the
// user does not exist or is inactive.
func isTransientLookupError(err error) bool {
	if errors.Is(err, context.DeadlineExceeded) || errors.Is(err, context.Canceled) {
		return true
	}
	return apperrors.IsErrorType(err, apperrors.ErrorTypeDatabase) ||
		apperrors.IsErrorType(err, apperrors.ErrorTypeTimeout) ||
		apperrors.IsErrorType(err, apperrors.ErrorTypeUnavailable)
}

// RequireRole enforces role-based access control
func RequireRole(role string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userVal, exists := c.Get("User")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "user context required",
			})
			c.Abort()
			return
		}

		userModel, ok := userVal.(*dto.UserResponse)
		if !ok {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "invalid user context",
			})
			c.Abort()
			return
		}

		if userModel.Role != role {
			c.JSON(http.StatusForbidden, gin.H{
				"error": "insufficient permissions",
			})
			c.Abort()
			return
		}
		c.Next()
	}
}
