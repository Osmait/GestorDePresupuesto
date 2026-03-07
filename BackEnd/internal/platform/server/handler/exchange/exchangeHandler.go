package exchange

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	exchangeService "github.com/osmait/gestorDePresupuesto/internal/services/exchange"
)

func GetExchangeRate(service *exchangeService.ExchangeRateService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		rate, err := service.GetUSDtoDOP(ctx)
		if err != nil {
			_ = ctx.Error(err)
			return
		}
		ctx.JSON(http.StatusOK, rate)
	}
}

func ConvertCurrency(service *exchangeService.ExchangeRateService) gin.HandlerFunc {
	return func(ctx *gin.Context) {
		amountStr := ctx.Query("amount")
		if amountStr == "" {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "amount parameter is required"})
			return
		}

		amount, err := strconv.ParseFloat(amountStr, 64)
		if err != nil {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "invalid amount"})
			return
		}

		result, err := service.ConvertUSDToDOP(ctx, amount)
		if err != nil {
			_ = ctx.Error(err)
			return
		}
		ctx.JSON(http.StatusOK, result)
	}
}
