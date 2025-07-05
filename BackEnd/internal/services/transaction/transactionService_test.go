package transaction

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/osmait/gestorDePresupuesto/internal/domain/transaction"
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

func (m *MockTransaction) FindAll(ctx context.Context, date1 string, date2 string, id string) ([]*transaction.Transaction, error) {
	args := m.Called(ctx, date1, date2, id)
	return args.Get(0).([]*transaction.Transaction), args.Error(1)
}

func (m *MockTransaction) FindAllOfAllAccounts(ctx context.Context, date1 string, date2 string, id string) ([]*transaction.Transaction, error) {
	args := m.Called(ctx, date1, date2, id)
	return args.Get(0).([]*transaction.Transaction), args.Error(1)
}

func (m *MockTransaction) FindCurrentBudget(ctx context.Context, budgetId string) (float64, error) {
	args := m.Called(ctx, budgetId)
	return args.Get(0).(float64), args.Error(1)
}

func (m *MockTransaction) Delete(ctx context.Context, id string) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func TestTransactionService_CreateTransaction(t *testing.T) {
	mockRepo := &MockTransaction{}
	s := NewTransactionService(mockRepo)
	mockRepo.On("Save", context.Background(), mock.AnythingOfType("*transaction.Transaction")).Return(nil)

	ctx := context.Background()
	transaction := utils.GetNewRandomTransaction()
	err := s.CreateTransaction(ctx, transaction.Name, transaction.Description, transaction.Amount, transaction.TypeTransation, transaction.AccountId, transaction.UserId, transaction.CategoryId, transaction.BudgetId)
	assert.NoError(t, err, "CreateAccount should not return an error")
	mockRepo.AssertExpectations(t)
}

func TestFindAllTransaction(t *testing.T) {
	mockRepo := &MockTransaction{}
	s := NewTransactionService(mockRepo)

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
	s := NewTransactionService(mockRepo)

	expectedTransactions := utils.GetNewRandomTransaction()

	mockRepo.On("Delete", mock.Anything, mock.Anything).Return(nil)
	ctx := context.Background()
	err := s.DeleteTransaction(ctx, expectedTransactions.Id)
	assert.NoError(t, err, "CreateAccount should not return an error")
	mockRepo.AssertExpectations(t)
}

func TestFindAllTransactionofAllAccount(t *testing.T) {
	mockRepo := &MockTransaction{}
	s := NewTransactionService(mockRepo)

	expectedTransactions := []*transaction.Transaction{}
	for i := 0; i < 5; i++ {
		expectedTransactions = append(expectedTransactions, utils.GetNewRandomTransaction())
	}
	mockRepo.On("FindAllOfAllAccounts", context.Background(), mock.Anything, mock.Anything, mock.Anything).Return(expectedTransactions, nil)
	ctx := context.Background()
	currenTime := time.Now()
	date1 := fmt.Sprintf("%d/%d/%d", currenTime.Year(), currenTime.Month(), currenTime.Day()-7)
	date2 := fmt.Sprintf("%d/%d/%d", currenTime.Year(), currenTime.Month(), currenTime.Day()+1)
	_, err := s.FindAllOfAllAccounts(ctx, date1, date2, "1")
	assert.NoError(t, err, "CreateAccount should not return an error")
	mockRepo.AssertExpectations(t)
}
