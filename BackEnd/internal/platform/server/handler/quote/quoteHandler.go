package quote

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/osmait/gestorDePresupuesto/internal/services/quote"
)

type QuoteHandler struct {
	quoteService *quote.QuoteService
}

func NewQuoteHandler(quoteService *quote.QuoteService) *QuoteHandler {
	return &QuoteHandler{quoteService: quoteService}
}

func (h *QuoteHandler) GetQuote(ctx *gin.Context) {
	symbol := ctx.Param("symbol")
	if symbol == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "symbol is required"})
		return
	}

	price, currency, name, err := h.quoteService.GetQuote(symbol)
	if err != nil {
		if err.Error() == "quote not found" {
			ctx.JSON(http.StatusNotFound, gin.H{"error": "quote not found"})
		} else {
			ctx.JSON(http.StatusInternalServerError, gin.H{"error": "failed to fetch quote: " + err.Error()})
		}
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"symbol":               symbol,
		"regular_market_price": price,
		"currency":             currency,
		"name":                 name,
	})
}
