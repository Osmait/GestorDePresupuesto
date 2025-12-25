package middleware

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt"
	"github.com/osmait/gestorDePresupuesto/internal/config"
	dto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/user"
	"github.com/osmait/gestorDePresupuesto/internal/services/user"
)

// NO_AUTH_NEEDED defines routes that don't require authentication
var NO_AUTH_NEEDED = []string{
	"login",
	"login",
	"health",
	"ping",
	"metrics",
}

// shouldCheckToken determines if a route requires token validation
func shouldCheckToken(route string) bool {
	// 1. Check strict substring matches from list
	for _, p := range NO_AUTH_NEEDED {
		if strings.Contains(route, p) {
			return false
		}
	}

	// 2. Special case for /user routes (Registration, GetById)
	// Must allow "/user" and "/user/xxx" BUT NOT "/users/demos"
	// Also explicitly allow /auth/demo without allowing "demo" substring elsewhere
	if route == "/user" || strings.HasPrefix(route, "/user/") || route == "/auth/demo" {
		return false
	}

	return true
}

// AppClaims represents the JWT claims structure
type AppClaims struct {
	UserId string `json:"id"`
	jwt.StandardClaims
}

// AuthMiddleware provides JWT-based authentication with configurable secret
func AuthMiddleware(userService *user.UserService, config *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Skip authentication for certain routes
		if !shouldCheckToken(c.Request.URL.Path) {
			c.Next()
			return
		}

		// Extract Authorization header
		authHeader := strings.TrimSpace(c.GetHeader("Authorization"))
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "authorization header is required",
			})
			c.Abort()
			return
		}

		// Validate Authorization header format
		tokenParts := strings.Split(authHeader, " ")
		if len(tokenParts) != 2 || tokenParts[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "invalid authorization header format",
			})
			c.Abort()
			return
		}

		// Parse and validate JWT token
		token, err := jwt.ParseWithClaims(tokenParts[1], &AppClaims{}, func(t *jwt.Token) (interface{}, error) {
			// Validate signing method
			if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
			}
			// Use configurable secret from environment
			return []byte(config.JWT.Secret), nil
		})

		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "invalid or expired token",
			})
			c.Abort()
			return
		}

		// Extract claims
		claims, ok := token.Claims.(*AppClaims)
		if !ok || !token.Valid {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "invalid token claims",
			})
			c.Abort()
			return
		}

		// Validate user exists and is active
		user, err := userService.FindUserById(c, claims.UserId)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "user not found or inactive",
			})
			c.Abort()
			return
		}

		if user == nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "user not found",
			})
			c.Abort()
			return
		}

		// Set user context for downstream handlers
		c.Set("X-User-Id", claims.UserId)
		c.Set("User", user)
		c.Next()
	}
}

// RequireAuth is a helper middleware that enforces authentication
func RequireAuth(userService *user.UserService, config *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := strings.TrimSpace(c.GetHeader("Authorization"))
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error": "authentication required",
			})
			c.Abort()
			return
		}

		// Use the main auth middleware logic
		AuthMiddleware(userService, config)(c)
	}
}

// OptionalAuth provides optional authentication (doesn't fail if no token)
func OptionalAuth(userService *user.UserService, config *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := strings.TrimSpace(c.GetHeader("Authorization"))
		if authHeader == "" {
			// No auth header, continue without user context
			c.Next()
			return
		}

		// If header exists, validate it
		AuthMiddleware(userService, config)(c)
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
