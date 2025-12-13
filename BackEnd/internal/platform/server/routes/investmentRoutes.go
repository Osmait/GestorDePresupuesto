package routes

import (
	"github.com/gin-gonic/gin"
	handler "github.com/osmait/gestorDePresupuesto/internal/platform/server/handler/investment"
	"github.com/osmait/gestorDePresupuesto/internal/services/investment"
)

func InvestmentRoutes(s *gin.Engine, investmentServices *investment.InvestmentServices) {
	s.POST("/investment", handler.CreateInvestment(investmentServices))
	s.GET("/investment", handler.FindAllInvestment(investmentServices))
	s.DELETE("/investment/:id", handler.DeleteInvestment(investmentServices))
}
