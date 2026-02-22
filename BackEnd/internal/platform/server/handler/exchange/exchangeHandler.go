package exchange

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	apperrors "github.com/osmait/gestorDePresupuesto/internal/platform/errors"
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
			_ = ctx.Error(apperrors.NewValidationError("AMOUNT_REQUIRED", "amount parameter is required").WithContext(ctx.Request.Context()).WithOperation("ExchangeHandler.ConvertCurrency"))
			return
		}

		amount, err := strconv.ParseFloat(amountStr, 64)
		if err != nil {
			_ = ctx.Error(apperrors.NewValidationError("INVALID_AMOUNT", "invalid amount").WithCause(err).WithContext(ctx.Request.Context()).WithOperation("ExchangeHandler.ConvertCurrency"))
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
