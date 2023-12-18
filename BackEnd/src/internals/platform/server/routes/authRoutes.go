package routes

import (
	"github.com/gin-gonic/gin"
	handler "github.com/osmait/gestorDePresupuesto/src/internals/platform/server/handler/auth"
	"github.com/osmait/gestorDePresupuesto/src/internals/services/auth"
)

func AuhtRoutes(s *gin.Engine, authService *auth.AuthService) {
	s.POST("/login", handler.Login(authService))
}
