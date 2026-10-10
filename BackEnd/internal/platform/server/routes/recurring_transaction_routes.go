package routes

import (
	"github.com/gin-gonic/gin"
	handler "github.com/osmait/gestorDePresupuesto/internal/platform/server/handler/recurring_transaction"
	"github.com/osmait/gestorDePresupuesto/internal/services/recurring_transaction"
)

// RecurringTransactionProcessRoute registers POST /recurring-transactions/process.
//
// It must be registered AFTER AuthMiddleware but BEFORE RLSMiddleware: the
// processor claims and executes each due occurrence in its own transaction
// (with its own RLS settings) so occurrences commit independently. Wrapped by
// RLSMiddleware the request would already hold one pooled connection while
// every scheduler transaction needs another, which deadlocks once concurrent
// requests exhaust the pool.
func RecurringTransactionProcessRoute(s *gin.Engine, service *recurring_transaction.RecurringTransactionService) {
	h := handler.NewRecurringTransactionHandler(service)
	s.POST("/recurring-transactions/process", h.Process)
}

// RecurringTransactionRoutes registers the CRUD routes (inside the per-request
// RLS transaction).
func RecurringTransactionRoutes(s *gin.Engine, service *recurring_transaction.RecurringTransactionService) {
	h := handler.NewRecurringTransactionHandler(service)
	group := s.Group("/recurring-transactions")
	{
		group.POST("", h.Create)
		group.GET("", h.FindAll)
		group.PUT("/:id", h.Update)
		group.DELETE("/:id", h.Delete)
	}
}
