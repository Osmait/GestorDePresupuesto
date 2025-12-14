package transaction

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/osmait/gestorDePresupuesto/internal/domain/budget"
	"github.com/osmait/gestorDePresupuesto/internal/domain/transaction"
	dto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/transaction"
	"github.com/osmait/gestorDePresupuesto/internal/platform/utils"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

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

func (m *MockTransaction) FindAllOfAllAccountsWithFilters(ctx context.Context, userId string, filter *dto.TransactionFilter) ([]*transaction.Transaction, error) {
	args := m.Called(ctx, userId, filter)
	return args.Get(0).([]*transaction.Transaction), args.Error(1)
}

func (m *MockTransaction) FindAllWithFilters(ctx context.Context, filter *dto.TransactionFilter) ([]*transaction.Transaction, error) {
	args := m.Called(ctx, filter)
	return args.Get(0).([]*transaction.Transaction), args.Error(1)
}

func (m *MockTransaction) CountWithFilters(ctx context.Context, userId string, filter *dto.TransactionFilter) (int64, error) {
	args := m.Called(ctx, userId, filter)
	return args.Get(0).(int64), args.Error(1)
}

type MockBudgetRepository struct {
	mock.Mock
}

func (m *MockBudgetRepository) Save(ctx context.Context, budget *budget.Budget) error {
	args := m.Called(ctx, budget)
	return args.Error(0)
}

func (m *MockBudgetRepository) FindAll(ctx context.Context, userId string) ([]*budget.Budget, error) {
	args := m.Called(ctx, userId)
	return args.Get(0).([]*budget.Budget), args.Error(1)
}

func (m *MockBudgetRepository) FindOne(ctx context.Context, id string) (*budget.Budget, error) {
	args := m.Called(ctx, id)
	return args.Get(0).(*budget.Budget), args.Error(1)
}

func (m *MockBudgetRepository) Delete(ctx context.Context, id string, userId string) error {
	args := m.Called(ctx, id, userId)
	return args.Error(0)
}

func (m *MockBudgetRepository) FindByCategory(ctx context.Context, categoryId string) (*budget.Budget, error) {
	args := m.Called(ctx, categoryId)
	return args.Get(0).(*budget.Budget), args.Error(1)
}

func TestTransactionService_CreateTransaction(t *testing.T) {
	mockRepo := &MockTransaction{}
	mockBudgetRepo := &MockBudgetRepository{}
	s := NewTransactionService(mockRepo, mockBudgetRepo)

	mockBudgetRepo.On("FindByCategory", mock.Anything, mock.Anything).Return(utils.GetNewRandomBudget(), nil)
	mockRepo.On("Save", context.Background(), mock.AnythingOfType("*transaction.Transaction")).Return(nil)

	ctx := context.Background()
	transaction := utils.GetNewRandomTransaction()
	err := s.CreateTransaction(ctx, transaction.Name, transaction.Description, transaction.Amount, transaction.TypeTransation, transaction.AccountId, transaction.UserId, transaction.CategoryId, transaction.BudgetId)
	assert.NoError(t, err, "CreateAccount should not return an error")
	mockRepo.AssertExpectations(t)
}

func TestFindAllTransaction(t *testing.T) {
	mockRepo := &MockTransaction{}
	mockBudgetRepo := &MockBudgetRepository{}
	s := NewTransactionService(mockRepo, mockBudgetRepo)

	expectedTransactions := []*transaction.Transaction{}
	for i := 0; i < 10; i++ {
		expectedTransactions = append(expectedTransactions, utils.GetNewRandomTransaction())
	}

	mockRepo.On("FindAll", context.Background(), mock.Anything, mock.Anything, mock.Anything).Return(expectedTransactions, nil)

	ctx := context.Background()
	currenTime := time.Now()
	date1 := fmt.Sprintf("%d/%d/%d", currenTime.Year(), currenTime.Month(), currenTime.Day()-7)
	date2 := fmt.Sprintf("%d/%d/%d", currenTime.Year(), currenTime.Month(), currenTime.Day()+1)
	_, err := s.FindAll(ctx, date1, date2, "1")
	assert.NoError(t, err, "CreateAccount should not return an error")
	mockRepo.AssertExpectations(t)
}

func TestDeleteTransaction(t *testing.T) {
	mockRepo := &MockTransaction{}
	mockBudgetRepo := &MockBudgetRepository{}
	s := NewTransactionService(mockRepo, mockBudgetRepo)

	expectedTransactions := utils.GetNewRandomTransaction()

	mockRepo.On("Delete", mock.Anything, mock.Anything, mock.Anything).Return(nil)
	ctx := context.Background()
	err := s.DeleteTransaction(ctx, expectedTransactions.Id, "testUser")
	assert.NoError(t, err, "CreateAccount should not return an error")
	mockRepo.AssertExpectations(t)
}

func TestFindAllTransactionofAllAccount(t *testing.T) {
	mockRepo := &MockTransaction{}
	mockBudgetRepo := &MockBudgetRepository{}
	s := NewTransactionService(mockRepo, mockBudgetRepo)

	expectedTransactions := []*transaction.Transaction{}
	for i := 0; i < 5; i++ {
		expectedTransactions = append(expectedTransactions, utils.GetNewRandomTransaction())
	}
	mockRepo.On("FindAllOfAllAccounts", context.Background(), mock.Anything).Return(expectedTransactions, nil)
	ctx := context.Background()
	_, err := s.FindAllOfAllAccounts(ctx, "1")
	assert.NoError(t, err, "CreateAccount should not return an error")
	mockRepo.AssertExpectations(t)
}
