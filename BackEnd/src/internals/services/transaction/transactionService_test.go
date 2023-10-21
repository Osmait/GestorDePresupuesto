package transaction

import (
	"context"
	"testing"

	"github.com/osmait/gestorDePresupuesto/src/internals/domain/transaction"
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

func (m *MockTransaction) Delete(ctx context.Context, id string) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func TestTransactionService_CreateTransaction(t *testing.T) {
	mockRepo := &MockTransaction{}
	s := NewTransactionService(mockRepo)
	mockRepo.On("Save", mock.Anything, mock.Anything).Return(nil)

	ctx := context.Background()
	id := "1"
	name := "prueba"
	descrpition := "Para Probar el Service"
	amount := 1000.00
	typeTransaction := "bill"
	accountId := "1"

	err := s.CreateTransaction(ctx, id, name, descrpition, amount, typeTransaction, accountId)
	assert.NoError(t, err, "CreateAccount should not return an error")
	mockRepo.AssertExpectations(t)
}
