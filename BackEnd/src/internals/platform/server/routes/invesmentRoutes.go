package routes

import (
	"github.com/gin-gonic/gin"
	handler "github.com/osmait/gestorDePresupuesto/src/internals/platform/server/handler/invesment"
	"github.com/osmait/gestorDePresupuesto/src/internals/services/invesment"
)

func InvesmentRoutes(s *gin.Engine, invesmentServices *invesment.InvesmentServices) {
	s.POST("/invesment", handler.CreateInvesment(invesmentServices))
	s.GET("/invesment", handler.FindAllInvesment(invesmentServices))
	s.DELETE("/invesment/:id", handler.DeleteInvesment(invesmentServices))
}
