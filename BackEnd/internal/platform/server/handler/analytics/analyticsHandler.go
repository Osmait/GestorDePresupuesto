package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	analyticsdto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/analytics"
	errorHandler "github.com/osmait/gestorDePresupuesto/internal/platform/server/handler/error"
	"github.com/osmait/gestorDePresupuesto/internal/services/analytics"
)

func GetCategoryExpenses(analyticsService *analytics.AnalyticsService) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetString("X-User-Id")
		categoryExpenses, err := analyticsService.GetCategoryExpenses(c.Request.Context(), userID)
		if err != nil {
			errorHandler.ResponseByTypeOfErr(err, c)
			return
		}

		c.JSON(http.StatusOK, analyticsdto.NewGetCategoryExpensesResponse(categoryExpenses))
	}
}

func GetMonthlySummary(analyticsService *analytics.AnalyticsService) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetString("X-User-Id")
		monthlySummary, err := analyticsService.GetMonthlySummary(c.Request.Context(), userID)
		if err != nil {
			errorHandler.ResponseByTypeOfErr(err, c)
			return
		}

		c.JSON(http.StatusOK, analyticsdto.NewGetMonthlySummaryResponse(monthlySummary))
	}
}
