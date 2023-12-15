package routes

import (
	handler "github.com/osmait/gestorDePresupuesto/src/internals/platform/server/handler/transaction"
	"github.com/osmait/gestorDePresupuesto/src/internals/services/transaction"

	"github.com/gin-gonic/gin"
)

func TransactionRoutes(s *gin.Engine, transactionService *transaction.TransactionService) {
	s.POST("/transaction", handler.CreateTransaction(transactionService))
	s.GET("/transaction/:id", handler.FindAllTransaction(transactionService))
	s.DELETE("/transaction/:id", handler.DeleteTransaction(transactionService))
}
