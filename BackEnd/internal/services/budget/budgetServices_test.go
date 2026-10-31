package budget

import (
	"context"
	"testing"
	"time"

	"github.com/osmait/gestorDePresupuesto/internal/domain/budget"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
	"github.com/osmait/gestorDePresupuesto/internal/domain/transaction"
	dto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/budget"
	transactionDto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/transaction"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

type MockBudgetRepository struct {
	mock.Mock
}

func (m *MockBudgetRepository) Save(ctx context.Context, budget *budget.Budget) error {
	args := m.Called(ctx, budget)
	return args.Error(0)
}

func (m *MockBudgetRepository) FindAll(ctx context.Context, userId string) ([]*budget.Budget, error) {
	args := m.Called(ctx)
	return args.Get(0).([]*budget.Budget), args.Error(1)
}

func (m *MockBudgetRepository) Delete(ctx context.Context, id string, userId string) error {
	args := m.Called(ctx, id, userId)
	return args.Error(0)
}

func (m *MockBudgetRepository) FindOne(ctx context.Context, id string, userId string) (*budget.Budget, error) {
	args := m.Called(ctx, id, userId)
	return args.Get(0).(*budget.Budget), args.Error(1)
}

func (m *MockBudgetRepository) FindByCategory(ctx context.Context, categoryId string, userId string) (*budget.Budget, error) {
	args := m.Called(ctx, categoryId, userId)
	return args.Get(0).(*budget.Budget), args.Error(1)
}

func (m *MockBudgetRepository) Update(ctx context.Context, budget *budget.Budget) error {
	args := m.Called(ctx, budget)
	return args.Error(0)
}

func (m *MockBudgetRepository) Search(ctx context.Context, userId string, query string) ([]*budget.Budget, error) {
	args := m.Called(ctx, userId, query)
	return args.Get(0).([]*budget.Budget), args.Error(1)
}

type MockTransaction struct {
	mock.Mock
}

func (m *MockTransaction) Save(ctx context.Context, transaction *transaction.Transaction) error {
	args := m.Called(ctx, transaction)
	return args.Error(0)
}

func (m *MockTransaction) ResolveAndValidateCurrencyForAccount(ctx context.Context, userId string, accountId string, currency string) (string, error) {
	args := m.Called(ctx, userId, accountId, currency)
	return args.String(0), args.Error(1)
}

func (m *MockTransaction) Update(ctx context.Context, id string, transaction *transaction.Transaction) error {
	args := m.Called(ctx, id, transaction)
	return args.Error(0)
}

func (m *MockTransaction) FindAll(ctx context.Context, date1 string, date2 string, id string, userId string) ([]*transaction.Transaction, error) {
	args := m.Called(ctx, date1, date2, id, userId)
	return args.Get(0).([]*transaction.Transaction), args.Error(1)
}

func (m *MockTransaction) FindAllOfAllAccounts(ctx context.Context, id string) ([]*transaction.Transaction, error) {
	args := m.Called(ctx, id)
	return args.Get(0).([]*transaction.Transaction), args.Error(1)
}

func (m *MockTransaction) BalanceByAccountAndCurrency(ctx context.Context, accountId string, userId string, currency string) (money.Amount, error) {
	args := m.Called(ctx, accountId, userId, currency)
	return args.Get(0).(money.Amount), args.Error(1)
}

func (m *MockTransaction) FindCurrentCategorySpent(ctx context.Context, categoryId string, userId string, usdToDop money.Amount) (money.Amount, error) {
	args := m.Called(ctx, categoryId, userId, usdToDop)
	return args.Get(0).(money.Amount), args.Error(1)
}

func (m *MockTransaction) FindCurrentSpentByCategory(ctx context.Context, userId string, usdToDop money.Amount) (map[string]money.Amount, error) {
	args := m.Called(ctx, userId, usdToDop)
	return args.Get(0).(map[string]money.Amount), args.Error(1)
}

// TypeOf reports every transaction as a plain expense (editable and deletable).
func (m *MockTransaction) TypeOf(context.Context, string, string) (string, error) {
	return "bill", nil
}

func (m *MockTransaction) AccountAndCurrencyOf(context.Context, string, string) (string, string, error) {
	return "", "DOP", nil
}

func (m *MockTransaction) Delete(ctx context.Context, id string, userId string) error {
	args := m.Called(ctx, id, userId)
	return args.Error(0)
}

func (m *MockTransaction) FindAllOfAllAccountsWithFilters(ctx context.Context, userId string, filter *transactionDto.TransactionFilter) ([]*transaction.Transaction, error) {
	args := m.Called(ctx, userId, filter)
	return args.Get(0).([]*transaction.Transaction), args.Error(1)
}

func (m *MockTransaction) FindAllWithFilters(ctx context.Context, userId string, filter *transactionDto.TransactionFilter) ([]*transaction.Transaction, error) {
	args := m.Called(ctx, userId, filter)
	return args.Get(0).([]*transaction.Transaction), args.Error(1)
}

func (m *MockTransaction) CountWithFilters(ctx context.Context, userId string, filter *transactionDto.TransactionFilter) (int64, error) {
	args := m.Called(ctx, userId, filter)
	return args.Get(0).(int64), args.Error(1)
}

func (m *MockTransaction) FindByUserAndDateRange(ctx context.Context, userId string, dateFrom time.Time, dateTo time.Time) ([]*transaction.Transaction, error) {
	args := m.Called(ctx, userId, dateFrom, dateTo)
	return args.Get(0).([]*transaction.Transaction), args.Error(1)
}

func TestCreateBudget(t *testing.T) {
	mockRepoBudget := &MockBudgetRepository{}
	mockRepoTransaction := &MockTransaction{}

	budgetService := NewBudgetServices(mockRepoBudget, mockRepoTransaction, nil)

	mockRepoBudget.On("Save", mock.Anything, mock.Anything).Return(nil)

	ctx := context.Background()
	budgetRequest := dto.NewBudgetRequest("123", money.FromInt(1000))
	err := budgetService.CreateBudget(ctx, budgetRequest, "123")
	assert.NoError(t, err)
}

func TestGetAllBudgets(t *testing.T) {
	mockRepoBudget := &MockBudgetRepository{}
	mockRepoTransaction := &MockTransaction{}
	budgetService := NewBudgetServices(mockRepoBudget, mockRepoTransaction, nil)
	listBudget := []*budget.Budget{
		{Id: "123", CategoryId: "123", UserId: "123", Amount: money.FromInt(1000)},
		{Id: "123", CategoryId: "123", UserId: "123", Amount: money.FromInt(1000)},
	}
	budgetsMap := map[string]money.Amount{"123": money.FromInt(1000)}

	mockRepoBudget.On("FindAll", mock.Anything).Return(listBudget, nil)
	mockRepoTransaction.On("FindCurrentSpentByCategory", mock.Anything, mock.Anything, mock.Anything).Return(budgetsMap, nil)
	ctx := context.Background()
	_, err := budgetService.FindAll(ctx, "123")
	assert.NoError(t, err)
}

func TestDeleteBudget(t *testing.T) {
	mockRepoBudget := &MockBudgetRepository{}
	mockRepoTransaction := &MockTransaction{}
	budgetService := NewBudgetServices(mockRepoBudget, mockRepoTransaction, nil)
	budget := budget.Budget{Id: "123", CategoryId: "123", UserId: "123", Amount: money.FromInt(1000)}
	budgetID := budget.Id
	userID := budget.UserId
	mockRepoBudget.On("Delete", context.Background(), budgetID, userID).Return(nil)
	ctx := context.Background()
	err := budgetService.Delete(ctx, budgetID, userID)
	assert.NoError(t, err)
	mockRepoBudget.AssertExpectations(t)
}
