package routes

import (
	"github.com/gin-gonic/gin"
	exchangeHandler "github.com/osmait/gestorDePresupuesto/internal/platform/server/handler/exchange"
	exchangeService "github.com/osmait/gestorDePresupuesto/internal/services/exchange"
)

func ExchangeRoutes(s *gin.Engine, exchangeService *exchangeService.ExchangeRateService) {
	exchangeGroup := s.Group("/exchange")
	{
		exchangeGroup.GET("/rate", exchangeHandler.GetExchangeRate(exchangeService))
		exchangeGroup.GET("/convert", exchangeHandler.ConvertCurrency(exchangeService))
	}
}
