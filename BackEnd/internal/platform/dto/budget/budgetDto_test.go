package dto

import (
	"testing"

	"github.com/go-playground/assert/v2"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money/moneytest"
	"github.com/osmait/gestorDePresupuesto/internal/platform/utils"
)

func TestBudgetRequest(t *testing.T) {
	budget := utils.GetNewRandomBudget()
	budgetRequest := NewBudgetRequest(budget.CategoryId, budget.Amount)
	moneytest.Equal(t, budget.Amount, budgetRequest.Amount)
}

func TestBudgetResponse(t *testing.T) {
	budget := utils.GetNewRandomBudget()
	currentBalance := money.FromInt(1000)
	budgetResponse := NewBudgetReponse(budget.Id, budget.CategoryId, budget.UserId, budget.Amount, currentBalance, budget.CreatedAt)
	moneytest.Equal(t, budget.Amount, budgetResponse.Amount)
	assert.Equal(t, budget.Id, budgetResponse.Id)
	assert.Equal(t, budget.CategoryId, budgetResponse.CategoryId)
	assert.Equal(t, budget.UserId, budgetResponse.UserId)
	assert.Equal(t, budget.CreatedAt, budgetResponse.CreatedAt)
	moneytest.Equal(t, currentBalance, budgetResponse.CurrentAmount)
}
