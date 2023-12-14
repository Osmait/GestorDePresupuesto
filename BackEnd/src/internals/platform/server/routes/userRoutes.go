package routes

import (
	"github.com/gin-gonic/gin"
	handler "github.com/osmait/gestorDePresupuesto/src/internals/platform/server/handler/user"
	"github.com/osmait/gestorDePresupuesto/src/internals/services/user"
)

func UserRoute(s *gin.Engine, userService user.UserService) {
	s.GET("user/:id", handler.GetUser(userService))
	s.POST("user", handler.CreateUser(userService))
}
