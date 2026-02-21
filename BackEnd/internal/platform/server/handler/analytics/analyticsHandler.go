package handler

import (
	"net/http"
	"time"

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

func GetDashboardSummary(analyticsService *analytics.AnalyticsService) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetString("X-User-Id")

		filters := analytics.DashboardFilters{
			AccountID:       c.Query("account_id"),
			CategoryID:      c.Query("category_id"),
			TransactionType: c.Query("type"),
		}

		if dateFromStr := c.Query("date_from"); dateFromStr != "" {
			if parsed, parseErr := time.Parse("2006-01-02", dateFromStr); parseErr == nil {
				filters.DateFrom = parsed
			}
		}

		if dateToStr := c.Query("date_to"); dateToStr != "" {
			if parsed, parseErr := time.Parse("2006-01-02", dateToStr); parseErr == nil {
				filters.DateTo = parsed
			}
		}

		summary, err := analyticsService.GetDashboardSummary(c.Request.Context(), userID, filters)
		if err != nil {
			errorHandler.ResponseByTypeOfErr(err, c)
			return
		}

		c.JSON(http.StatusOK, analyticsdto.NewDashboardSummaryResponse(summary))
	}
}
