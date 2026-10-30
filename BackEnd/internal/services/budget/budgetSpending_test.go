package budget

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/osmait/gestorDePresupuesto/internal/domain/budget"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
)

// A budget's spending is its category's bills this month, whatever budget_id
// the bills were stamped with: budgets sharing a category report the same
// spending, and a category without bills this month reports 0.
func TestFindAll_SpendingByCategory(t *testing.T) {
	t.Parallel()
	mockRepoBudget := &MockBudgetRepository{}
	mockRepoTransaction := &MockTransaction{}
	budgetService := NewBudgetServices(mockRepoBudget, mockRepoTransaction, nil)
	mockRepoBudget.On("FindAll", mock.Anything).Return([]*budget.Budget{
		{Id: "food-new", CategoryId: "food", UserId: "user-1", Amount: money.FromInt(5000)},
		{Id: "food-old", CategoryId: "food", UserId: "user-1", Amount: money.FromInt(8000)},
		{Id: "fun", CategoryId: "fun", UserId: "user-1", Amount: money.FromInt(1000)},
	}, nil)
	mockRepoTransaction.On("FindCurrentSpentByCategory", mock.Anything, "user-1", mock.Anything).
		Return(map[string]money.Amount{"food": money.MustParse("3000.004")}, nil)

	got, err := budgetService.FindAll(context.Background(), "user-1")
	require.NoError(t, err)
	spent := map[string]string{}
	for _, b := range got {
		spent[b.Id] = b.CurrentAmount.StringFixed(2)
	}
	assert.Equal(t, map[string]string{"food-new": "3000.00", "food-old": "3000.00", "fun": "0.00"}, spent)
}
