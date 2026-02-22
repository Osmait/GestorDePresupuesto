package quote

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	apperrors "github.com/osmait/gestorDePresupuesto/internal/platform/errors"
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
		_ = ctx.Error(apperrors.NewValidationError("SYMBOL_REQUIRED", "symbol is required").WithContext(ctx.Request.Context()).WithOperation("QuoteHandler.GetQuote"))
		return
	}

	price, currency, name, err := h.quoteService.GetQuote(symbol)
	if err != nil {
		if strings.Contains(strings.ToLower(err.Error()), "not found") {
			_ = ctx.Error(apperrors.NewNotFoundError("QUOTE", symbol).WithCause(err).WithContext(ctx.Request.Context()).WithOperation("QuoteHandler.GetQuote"))
			return
		}
		_ = ctx.Error(apperrors.NewInternalError("failed to fetch quote", err).WithContext(ctx.Request.Context()).WithOperation("QuoteHandler.GetQuote"))
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"symbol":               symbol,
		"regular_market_price": price,
		"currency":             currency,
		"name":                 name,
	})
}
