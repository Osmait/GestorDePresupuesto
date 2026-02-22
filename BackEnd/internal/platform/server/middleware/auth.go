package middleware

import (
	"context"
	"fmt"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/osmait/gestorDePresupuesto/internal/config"
	dto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/user"
	apperrors "github.com/osmait/gestorDePresupuesto/internal/platform/errors"
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
	if route == "/user" || strings.HasPrefix(route, "/user/") {
		return false
	}

	// 3. Auth routes that don't require authentication
	authNoAuthRoutes := []string{
		"/auth/login",
		"/auth/refresh",
		"/auth/logout",
		"/auth/demo",
	}
	for _, r := range authNoAuthRoutes {
		if route == r {
			return false
		}
	}

	return true
}

// AppClaims represents the JWT claims structure
type AppClaims struct {
	UserId string `json:"id"`
	jwt.RegisteredClaims
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
			_ = c.Error(apperrors.NewUnauthorizedError("authorization header is required").WithContext(c.Request.Context()).WithOperation("AuthMiddleware"))
			c.Abort()
			return
		}

		// Validate Authorization header format
		tokenParts := strings.Split(authHeader, " ")
		if len(tokenParts) != 2 || tokenParts[0] != "Bearer" {
			_ = c.Error(apperrors.NewUnauthorizedError("invalid authorization header format").WithContext(c.Request.Context()).WithOperation("AuthMiddleware"))
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
			_ = c.Error(apperrors.NewUnauthorizedError("invalid or expired token").WithCause(err).WithContext(c.Request.Context()).WithOperation("AuthMiddleware"))
			c.Abort()
			return
		}

		// Extract claims
		claims, ok := token.Claims.(*AppClaims)
		if !ok || !token.Valid {
			_ = c.Error(apperrors.NewUnauthorizedError("invalid token claims").WithContext(c.Request.Context()).WithOperation("AuthMiddleware"))
			c.Abort()
			return
		}

		// Validate user exists and is active
		user, err := userService.FindUserById(c, claims.UserId)
		if err != nil {
			_ = c.Error(apperrors.NewUnauthorizedError("user not found or inactive").WithCause(err).WithContext(c.Request.Context()).WithOperation("AuthMiddleware"))
			c.Abort()
			return
		}

		if user == nil {
			_ = c.Error(apperrors.NewUnauthorizedError("user not found").WithContext(c.Request.Context()).WithOperation("AuthMiddleware"))
			c.Abort()
			return
		}

		// Set user context for downstream handlers
		c.Set("X-User-Id", claims.UserId)
		c.Set("User", user)
		ctxWithUser := context.WithValue(c.Request.Context(), apperrors.ContextKeyUserID, claims.UserId)
		c.Request = c.Request.WithContext(ctxWithUser)
		c.Next()
	}
}

// RequireAuth is a helper middleware that enforces authentication
func RequireAuth(userService *user.UserService, config *config.Config) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := strings.TrimSpace(c.GetHeader("Authorization"))
		if authHeader == "" {
			_ = c.Error(apperrors.NewUnauthorizedError("authentication required").WithContext(c.Request.Context()).WithOperation("RequireAuth"))
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
			_ = c.Error(apperrors.NewUnauthorizedError("user context required").WithContext(c.Request.Context()).WithOperation("RequireRole"))
			c.Abort()
			return
		}

		userModel, ok := userVal.(*dto.UserResponse)
		if !ok {
			_ = c.Error(apperrors.NewInternalError("invalid user context", nil).WithContext(c.Request.Context()).WithOperation("RequireRole"))
			c.Abort()
			return
		}

		if userModel.Role != role {
			_ = c.Error(apperrors.NewForbiddenError("insufficient permissions").WithContext(c.Request.Context()).WithOperation("RequireRole"))
			c.Abort()
			return
		}
		c.Next()
	}
}
