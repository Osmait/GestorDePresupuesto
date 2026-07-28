package routes

import (
	"github.com/gin-gonic/gin"

	monthlyPlanHandler "github.com/osmait/gestorDePresupuesto/internal/platform/server/handler/monthly_plan"
	"github.com/osmait/gestorDePresupuesto/internal/services/monthly_plan"
)

func MonthlyPlanRoutes(s *gin.Engine, service *monthly_plan.MonthlyPlanService) {
	group := s.Group("/monthly-plan")
	{
		group.POST("", monthlyPlanHandler.CreateItem(service))
		group.GET("", monthlyPlanHandler.FindAllItems(service))
		group.GET("/summary", monthlyPlanHandler.GetSummary(service))
		group.PUT("/:id", monthlyPlanHandler.UpdateItem(service))
		group.PATCH("/:id/active", monthlyPlanHandler.ToggleItem(service))
		group.DELETE("/:id", monthlyPlanHandler.DeleteItem(service))
	}
}
