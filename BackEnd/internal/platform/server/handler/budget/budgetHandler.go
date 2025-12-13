package budgetHandler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/osmait/gestorDePresupuesto/internal/services/budget"

	dto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/budget"
	errorHandler "github.com/osmait/gestorDePresupuesto/internal/platform/server/handler/error"
)

// CreateBudget godoc
//
//	@Summary		Create a new budget
//	@Description	Create a new budget limit for a specific category for the authenticated user
//	@Tags			Budgets
//	@Accept			json
//	@Produce		json
//	@Security		JWT
//	@Param			budget	body		dto.BudgetRequest	true	"Budget creation data"
//	@Success		201		{object}	map[string]string	"Budget created successfully"
//	@Failure		400		{object}	map[string]string	"Bad request - Invalid input"
//	@Failure		401		{object}	map[string]string	"Unauthorized - Invalid JWT token"
//	@Failure		500		{object}	map[string]string	"Internal server error"
//	@Router			/budget [post]
func CreateBudget(budgetServices *budget.BudgetServices) gin.HandlerFunc {
	return func(c *gin.Context) {
		var budget dto.BudgetRequest

		userId := c.GetString("X-User-Id")
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

// FindAllBudget godoc
//
//	@Summary		Get all user budgets
//	@Description	Retrieve all budget limits for the authenticated user
//	@Tags			Budgets
//	@Accept			json
//	@Produce		json
//	@Security		JWT
//	@Success		200	{array}		dto.BudgetResponse	"List of user budgets"
//	@Failure		401	{object}	map[string]string	"Unauthorized - Invalid JWT token"
//	@Failure		500	{object}	map[string]string	"Internal server error"
//	@Router			/budget [get]
func FindAllBudget(budgetServices *budget.BudgetServices) gin.HandlerFunc {
	return func(c *gin.Context) {
		userId := c.GetString("X-User-Id")
		budgets, err := budgetServices.FindAll(c, userId)
		if err != nil {
			errorHandler.ReponseByTypeOfErr(err, c)
			return
		}
		c.JSON(http.StatusOK, budgets)
	}
}

// DeleteBudget godoc
//
//	@Summary		Delete a budget
//	@Description	Delete a specific budget by ID
//	@Tags			Budgets
//	@Accept			json
//	@Produce		json
//	@Security		JWT
//	@Param			id	path		string				true	"Budget ID"
//	@Success		200	{object}	map[string]string	"Budget deleted successfully"
//	@Failure		401	{object}	map[string]string	"Unauthorized - Invalid JWT token"
//	@Failure		404	{object}	map[string]string	"Budget not found"
//	@Failure		500	{object}	map[string]string	"Internal server error"
//	@Router			/budget/{id} [delete]
func DeleteBudget(budgetServices *budget.BudgetServices) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.Param("id")
		userId := c.GetString("X-User-Id")
		err := budgetServices.Delete(c, id, userId)
		if err != nil {
			errorHandler.ReponseByTypeOfErr(err, c)
			return
		}
		c.JSON(http.StatusOK, "Deleted")
	}
}
