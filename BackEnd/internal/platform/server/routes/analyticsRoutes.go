package routes

import (
	"github.com/gin-gonic/gin"
	analyticsHandler "github.com/osmait/gestorDePresupuesto/internal/platform/server/handler/analytics"
	"github.com/osmait/gestorDePresupuesto/internal/services/analytics"
)

func AnalyticsRoutes(r *gin.Engine, analyticsService *analytics.AnalyticsService) {
	analytics := r.Group("/analytics")
	analytics.GET("/category-expenses", analyticsHandler.GetCategoryExpenses(analyticsService))
	analytics.GET("/monthly-summary", analyticsHandler.GetMonthlySummary(analyticsService))
}
