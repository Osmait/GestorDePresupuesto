package dto

import (
	"testing"

	"github.com/go-playground/assert/v2"
	"github.com/osmait/gestorDePresupuesto/internal/platform/utils"
)

func TestBudgetRequest(t *testing.T) {
	budget := utils.GetNewRandomBudget()
	budgetRequest := NewBudgetRequest(budget.CategoryId, budget.Amount)
	assert.Equal(t, budget.Amount, budgetRequest.Amount)
}

func TestBudgetResponse(t *testing.T) {
	budget := utils.GetNewRandomBudget()
	currentBalance := 1000.00
	budgetResponse := NewBudgetReponse(budget.Id, budget.CategoryId, budget.UserId, budget.Amount, currentBalance, budget.CreatedAt)
	assert.Equal(t, budget.Amount, budgetResponse.Amount)
	assert.Equal(t, budget.Id, budgetResponse.Id)
	assert.Equal(t, budget.CategoryId, budgetResponse.CategoryId)
	assert.Equal(t, budget.UserId, budgetResponse.UserId)
	assert.Equal(t, budget.CreatedAt, budgetResponse.CreatedAt)
	assert.Equal(t, currentBalance, budgetResponse.CurrentAmount)
}
