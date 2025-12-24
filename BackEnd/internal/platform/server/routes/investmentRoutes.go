package routes

import (
	"github.com/gin-gonic/gin"
	investmentHandler "github.com/osmait/gestorDePresupuesto/internal/platform/server/handler/investment"
	investmentService "github.com/osmait/gestorDePresupuesto/internal/services/investment"
)

func InvestmentRoutes(r *gin.Engine, service *investmentService.InvestmentService) {
	handler := investmentHandler.NewInvestmentHandler(service)
	routes := r.Group("/investments")
	{
		routes.POST("", handler.Create)
		routes.GET("", handler.FindAll)
		routes.PUT("", handler.Update)
		routes.DELETE("/:id", handler.Delete)
	}
}
