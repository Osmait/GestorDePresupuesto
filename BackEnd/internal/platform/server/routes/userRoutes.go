package routes

import (
	"github.com/gin-gonic/gin"
	handler "github.com/osmait/gestorDePresupuesto/internal/platform/server/handler/user"
	"github.com/osmait/gestorDePresupuesto/internal/platform/server/middleware"
	"github.com/osmait/gestorDePresupuesto/internal/services/user"
)

func UserRoute(s *gin.Engine, userService *user.UserService) {
	s.GET("user/:id", handler.GetUser(userService))
	s.GET("/profile", handler.GetProfile(userService))
	s.POST("user", handler.CreateUser(userService))
	s.DELETE("/users/demos", middleware.RequireRole("ADMIN"), handler.CleanupDemoUsers(userService))
}
