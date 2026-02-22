package routes

import (
	"database/sql"

	"github.com/gin-gonic/gin"
	investmentHandler "github.com/osmait/gestorDePresupuesto/internal/platform/server/handler/investment"
	"github.com/osmait/gestorDePresupuesto/internal/platform/server/middleware"
	investmentService "github.com/osmait/gestorDePresupuesto/internal/services/investment"
)

func InvestmentRoutes(r *gin.Engine, service *investmentService.InvestmentService, db *sql.DB) {
	handler := investmentHandler.NewInvestmentHandler(service)
	routes := r.Group("/investments", middleware.RequireFeature(db, "module_investments"))
	{
		routes.POST("/funding", handler.FundBroker)
		routes.GET("/funding/balances", handler.GetFundingBalances)
		routes.POST("", handler.Create)
		routes.GET("", handler.FindAll)
		routes.PUT("", handler.Update)
		routes.DELETE("/:id", handler.Delete)
	}
}
