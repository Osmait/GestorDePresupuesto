package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/osmait/gestorDePresupuesto/internal/config"
	dto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/user"
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
	http.MethodGet + " /metrics":                    true,
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

		// Validate user exists and is active
		u, err := userService.FindUserById(c, claims.UserId)
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
