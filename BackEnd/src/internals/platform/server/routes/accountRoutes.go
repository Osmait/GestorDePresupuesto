package routes

import (
	"github.com/gin-gonic/gin"
	handler "github.com/osmait/gestorDePresupuesto/src/internals/platform/server/handler/account"
	"github.com/osmait/gestorDePresupuesto/src/internals/services/account"
)

func AccountRotes(s *gin.Engine, acountService account.AccountService) {
	s.POST("/account", handler.CreateAccount(acountService))
	s.GET("/account", handler.FindAllAccount(acountService))
	s.DELETE("/account/:id", handler.DeleteAccount(acountService))
}
