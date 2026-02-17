package routes

import (
	"github.com/gin-gonic/gin"
	handler "github.com/osmait/gestorDePresupuesto/internal/platform/server/handler/auth"
	"github.com/osmait/gestorDePresupuesto/internal/services/auth"
)

func AuhtRoutes(s *gin.Engine, authService *auth.AuthService) {
	// Legacy login endpoint (returns only access token)
	s.POST("/login", handler.Login(authService))

	// Auth group with new token-based endpoints
	authGroup := s.Group("/auth")
	{
		// Login with refresh token support
		authGroup.POST("/login", handler.LoginWithTokens(authService))

		// Refresh tokens
		authGroup.POST("/refresh", handler.RefreshTokens(authService))

		// Logout (revoke refresh token)
		authGroup.POST("/logout", handler.Logout(authService))

		// Logout from all devices (requires authentication)
		authGroup.POST("/logout-all", handler.LogoutAll(authService))

		// Demo user login
		authGroup.POST("/demo", handler.DemoLogin(authService))
	}
}
