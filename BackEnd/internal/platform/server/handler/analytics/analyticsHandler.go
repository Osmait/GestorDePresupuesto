package handler

import (
	"net/http"
	"strconv"
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

		if minAmountStr := c.Query("min_amount"); minAmountStr != "" {
			if parsed, parseErr := strconv.ParseFloat(minAmountStr, 64); parseErr == nil && parsed >= 0 {
				filters.MinAmount = &parsed
			}
		}

		if maxAmountStr := c.Query("max_amount"); maxAmountStr != "" {
			if parsed, parseErr := strconv.ParseFloat(maxAmountStr, 64); parseErr == nil && parsed >= 0 {
				filters.MaxAmount = &parsed
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
