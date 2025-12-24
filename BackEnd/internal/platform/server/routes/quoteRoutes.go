package routes

import (
	"github.com/gin-gonic/gin"
	"github.com/osmait/gestorDePresupuesto/internal/platform/server/handler/quote"
	quoteService "github.com/osmait/gestorDePresupuesto/internal/services/quote"
)

func QuoteRoutes(r *gin.Engine, service *quoteService.QuoteService) {
	handler := quote.NewQuoteHandler(service)
	routes := r.Group("/quotes")
	{
		routes.GET("/:symbol", handler.GetQuote)
	}
}
