package routes

import (
	"github.com/gin-gonic/gin"
	handler "github.com/osmait/gestorDePresupuesto/internal/platform/server/handler/account"
	"github.com/osmait/gestorDePresupuesto/internal/services/account"
)

func AccountRotes(s *gin.Engine, acountService *account.AccountService) {
	s.POST("/account", handler.CreateAccount(acountService))
	s.GET("/account", handler.FindAllAccount(acountService))
	s.DELETE("/account/:id", handler.DeleteAccount(acountService))
	s.GET("/account/:id", handler.FindAccount(acountService))
	s.PUT("/account/:id", handler.UpdateAccount(acountService))
	s.POST("/account/:id/reconcile", handler.ReconcileAccount(acountService))
	s.GET("/account/:id/reconciliations", handler.ListReconciliations(acountService))
}
