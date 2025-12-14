package budget

import (
	"context"
	"testing"

	"github.com/osmait/gestorDePresupuesto/internal/domain/budget"
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

func (m *MockBudgetRepository) FindOne(ctx context.Context, id string) (*budget.Budget, error) {
	args := m.Called(ctx, id)
	return args.Get(0).(*budget.Budget), args.Error(1)
}

func (m *MockBudgetRepository) FindByCategory(ctx context.Context, categoryId string) (*budget.Budget, error) {
	args := m.Called(ctx, categoryId)
	return args.Get(0).(*budget.Budget), args.Error(1)
}

type MockTransaction struct {
	mock.Mock
}

func (m *MockTransaction) Save(ctx context.Context, transaction *transaction.Transaction) error {
	args := m.Called(ctx, transaction)
	return args.Error(0)
}

func (m *MockTransaction) Update(ctx context.Context, id string, transaction *transaction.Transaction) error {
	args := m.Called(ctx, id, transaction)
	return args.Error(0)
}

func (m *MockTransaction) FindAll(ctx context.Context, date1 string, date2 string, id string) ([]*transaction.Transaction, error) {
	args := m.Called(ctx, date1, date2, id)
	return args.Get(0).([]*transaction.Transaction), args.Error(1)
}

func (m *MockTransaction) FindAllOfAllAccounts(ctx context.Context, id string) ([]*transaction.Transaction, error) {
	args := m.Called(ctx, id)
	return args.Get(0).([]*transaction.Transaction), args.Error(1)
}

func (m *MockTransaction) FindCurrentBudget(ctx context.Context, budgetId string) (float64, error) {
	args := m.Called(ctx, budgetId)
	return args.Get(0).(float64), args.Error(1)
}

func (m *MockTransaction) FindCurrentBudgets(ctx context.Context, userId string) (map[string]float64, error) {
	args := m.Called(ctx, userId)
	return args.Get(0).(map[string]float64), args.Error(1)
}

func (m *MockTransaction) Delete(ctx context.Context, id string, userId string) error {
	args := m.Called(ctx, id, userId)
	return args.Error(0)
}

func (m *MockTransaction) FindAllOfAllAccountsWithFilters(ctx context.Context, userId string, filter *transactionDto.TransactionFilter) ([]*transaction.Transaction, error) {
	args := m.Called(ctx, userId, filter)
	return args.Get(0).([]*transaction.Transaction), args.Error(1)
}

func (m *MockTransaction) FindAllWithFilters(ctx context.Context, filter *transactionDto.TransactionFilter) ([]*transaction.Transaction, error) {
	args := m.Called(ctx, filter)
	return args.Get(0).([]*transaction.Transaction), args.Error(1)
}

func (m *MockTransaction) CountWithFilters(ctx context.Context, userId string, filter *transactionDto.TransactionFilter) (int64, error) {
	args := m.Called(ctx, userId, filter)
	return args.Get(0).(int64), args.Error(1)
}

func TestCreateBudget(t *testing.T) {
	mockRepoBudget := &MockBudgetRepository{}
	mockRepoTransaction := &MockTransaction{}

	budgetService := NewBudgetServices(mockRepoBudget, mockRepoTransaction)

	mockRepoBudget.On("Save", mock.Anything, mock.Anything).Return(nil)

	ctx := context.Background()
	budgetRequest := dto.NewBudgetRequest("123", 1000.0)
	err := budgetService.CreateBudget(ctx, budgetRequest, "123")
	assert.NoError(t, err)
}

func TestGetAllBudgets(t *testing.T) {
	mockRepoBudget := &MockBudgetRepository{}
	mockRepoTransaction := &MockTransaction{}
	budgetService := NewBudgetServices(mockRepoBudget, mockRepoTransaction)
	listBudget := []*budget.Budget{
		{Id: "123", CategoryId: "123", UserId: "123", Amount: 1000.0},
		{Id: "123", CategoryId: "123", UserId: "123", Amount: 1000.0},
	}
	budgetsMap := map[string]float64{"123": 1000.0}

	mockRepoBudget.On("FindAll", mock.Anything).Return(listBudget, nil)
	mockRepoTransaction.On("FindCurrentBudgets", mock.Anything, mock.Anything).Return(budgetsMap, nil)
	ctx := context.Background()
	_, err := budgetService.FindAll(ctx, "123")
	assert.NoError(t, err)
}

func TestDeleteBudget(t *testing.T) {
	mockRepoBudget := &MockBudgetRepository{}
	mockRepoTransaction := &MockTransaction{}
	budgetService := NewBudgetServices(mockRepoBudget, mockRepoTransaction)
	budget := budget.Budget{Id: "123", CategoryId: "123", UserId: "123", Amount: 1000.0}
	budgetID := budget.Id
	userID := budget.UserId
	mockRepoBudget.On("FindOne", mock.Anything, mock.Anything).Return(&budget, nil)
	mockRepoBudget.On("Delete", context.Background(), budgetID, userID).Return(nil)
	ctx := context.Background()
	err := budgetService.Delete(ctx, budgetID, userID)
	assert.NoError(t, err)
}
