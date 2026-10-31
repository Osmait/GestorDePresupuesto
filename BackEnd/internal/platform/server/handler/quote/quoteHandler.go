package quote

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/osmait/gestorDePresupuesto/internal/services/quote"
	"github.com/rs/zerolog/log"
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

	// ?type=crypto prices the symbol as a coin (Binance first).
	class := quote.AssetAny
	if ctx.Query("type") == string(quote.AssetCrypto) {
		class = quote.AssetCrypto
	}
	price, currency, name, err := h.quoteService.GetAssetQuote(ctx.Request.Context(), symbol, class)
	if err != nil {
		switch {
		case errors.Is(err, quote.ErrInvalidSymbol):
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid symbol"})
		case errors.Is(err, quote.ErrQuoteUnavailable):
			ctx.JSON(http.StatusNotFound, gin.H{"error": "quote not found"})
		default:
			// Upstream details stay in the logs.
			log.Warn().Err(err).Str("symbol", symbol).Msg("quote lookup failed")
			ctx.JSON(http.StatusBadGateway, gin.H{"error": "failed to fetch quote"})
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
