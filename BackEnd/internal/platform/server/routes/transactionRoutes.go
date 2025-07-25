// Package routes provides HTTP route definitions for the Gestor de Presupuesto application.
// It contains route handlers for different entities including transactions, accounts, budgets, and categories.
package routes

import (
	handler "github.com/osmait/gestorDePresupuesto/internal/platform/server/handler/transaction"
	"github.com/osmait/gestorDePresupuesto/internal/services/transaction"

	"github.com/gin-gonic/gin"
)

func TransactionRoutes(s *gin.Engine, transactionService *transaction.TransactionService) {
	s.POST("/transaction", handler.CreateTransaction(transactionService))
	s.GET("/transaction/:id", handler.FindAllTransaction(transactionService))
	s.GET("/transaction", handler.FindAllTransactionOfAllAccount(transactionService))
	s.DELETE("/transaction/:id", handler.DeleteTransaction(transactionService))
}
