package budgetHandler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/osmait/gestorDePresupuesto/src/internals/services/budget"

	dto "github.com/osmait/gestorDePresupuesto/src/internals/platform/dto/budget"
	errorHandler "github.com/osmait/gestorDePresupuesto/src/internals/platform/server/handler/error"
)

func CreateBudget(budgetServices *budget.BudgetServices) gin.HandlerFunc {
	return func(c *gin.Context) {
		var budget dto.BudgetRequest

		userId := c.GetString("X-user-Id")
		err := c.Bind(&budget)
		if err != nil {
			c.JSON(http.StatusBadRequest, err)
			return
		}
		err = budgetServices.CreateBudget(c, &budget, userId)

		if err != nil {
			errorHandler.ReponseByTypeOfErr(err, c)
			return
		}
		c.JSON(http.StatusCreated, "created")
	}
}

func FindAllBudget(budgetServices *budget.BudgetServices) gin.HandlerFunc {
	return func(c *gin.Context) {
		userId := c.GetString("X-user-Id")
		budgets, err := budgetServices.FindAll(c, userId)
		if err != nil {
			errorHandler.ReponseByTypeOfErr(err, c)
			return
		}
		c.JSON(http.StatusOK, budgets)
	}
}

func DeleteBudget(budgetServices *budget.BudgetServices) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		err := budgetServices.Delete(c, id)
		if err != nil {
			errorHandler.ReponseByTypeOfErr(err, c)
			return
		}
		c.JSON(http.StatusOK, "Deleted")
	}
}
