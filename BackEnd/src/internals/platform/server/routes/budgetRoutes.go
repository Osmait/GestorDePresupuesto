package routes

import (
	"github.com/gin-gonic/gin"
	budgetHandler "github.com/osmait/gestorDePresupuesto/src/internals/platform/server/handler/budget"
	"github.com/osmait/gestorDePresupuesto/src/internals/services/budget"
)

func BudgetRoutes(s *gin.Engine, budgetServices *budget.BudgetServices) {
	s.POST("/budget", budgetHandler.CreateBudget(budgetServices))
	s.GET("/budget", budgetHandler.FindAllBudget(budgetServices))
	s.DELETE("/budget/:id", budgetHandler.DeleteBudget(budgetServices))
}
