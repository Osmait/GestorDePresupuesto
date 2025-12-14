package routes

import (
	"github.com/gin-gonic/gin"
	handler "github.com/osmait/gestorDePresupuesto/internal/platform/server/handler/recurring_transaction"
	"github.com/osmait/gestorDePresupuesto/internal/services/recurring_transaction"
)

func RecurringTransactionRoutes(s *gin.Engine, service *recurring_transaction.RecurringTransactionService) {
	h := handler.NewRecurringTransactionHandler(service)
	group := s.Group("/recurring-transactions")
	{
		group.POST("", h.Create)
		group.POST("/process", h.Process)
		group.GET("", h.FindAll)
		group.PUT("/:id", h.Update)
		group.DELETE("/:id", h.Delete)
	}
}
