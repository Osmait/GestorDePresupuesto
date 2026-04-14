package routes

import (
	"database/sql"

	"github.com/gin-gonic/gin"
	handler "github.com/osmait/gestorDePresupuesto/internal/platform/server/handler/creditcard"
	"github.com/osmait/gestorDePresupuesto/internal/platform/server/middleware"
	"github.com/osmait/gestorDePresupuesto/internal/services/creditcard"
)

func CreditCardRoutes(s *gin.Engine, creditCardService *creditcard.CreditCardService, db *sql.DB) {
	cardGroup := s.Group("/credit-cards", middleware.RequireFeature(db, "module_credit_cards"))
	{
		cardGroup.POST("", handler.CreateCreditCard(creditCardService))
		cardGroup.GET("", handler.FindAllCreditCards(creditCardService))
		cardGroup.GET("/summary", handler.GetCreditCardSummary(creditCardService))
		cardGroup.GET("/:id", handler.FindCreditCardById(creditCardService))
		cardGroup.PUT("/:id", handler.UpdateCreditCard(creditCardService))
		cardGroup.DELETE("/:id", handler.DeleteCreditCard(creditCardService))
		cardGroup.PUT("/:id/balances/:balanceId", handler.UpdateCardBalance(creditCardService))
		cardGroup.POST("/:id/payments", handler.CreateCardPayment(creditCardService))
		cardGroup.GET("/:id/payments", handler.FindCardPayments(creditCardService))
		cardGroup.POST("/:id/reset", handler.ResetCardBalance(creditCardService))
		cardGroup.GET("/:id/resets", handler.FindCardBalanceResets(creditCardService))
	}
}
