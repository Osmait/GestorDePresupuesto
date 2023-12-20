package account

import (
	"context"
	"testing"

	"github.com/osmait/gestorDePresupuesto/src/internals/domain/account"
	"github.com/osmait/gestorDePresupuesto/src/internals/platform/utils"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

type MockAccountRepository struct {
	mock.Mock
}

func (m *MockAccountRepository) Save(ctx context.Context, acc account.Account) error {
	args := m.Called(ctx, acc)
	return args.Error(0)
}

func (m *MockAccountRepository) FindAll(ctx context.Context, userId string) ([]*account.Account, error) {
	args := m.Called(ctx)
	return args.Get(0).([]*account.Account), args.Error(1)
}

func (m *MockAccountRepository) Delete(ctx context.Context, id string) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockAccountRepository) Balance(ctx context.Context, id string) (float64, error) {
	args := m.Called(ctx, id)
	return args.Get(0).(float64), args.Error(1)
}

func TestCreateAccount(t *testing.T) {
	mockRepo := &MockAccountRepository{}

	accountSvc := NewAccountService(mockRepo)

	ctx := context.Background()

	mockRepo.On("Save", ctx, mock.AnythingOfType("account.Account")).Return(nil)

	account := utils.GetNewRandomAccount()

	err := accountSvc.CreateAccount(ctx, account.Name, account.Bank, account.InitialBalance, account.Id)

	assert.NoError(t, err, "CreateAccount should not return an error")

	mockRepo.AssertExpectations(t)
}

func TestDeleteAccount(t *testing.T) {
	mockRepo := &MockAccountRepository{}

	mockRepo.On("Delete", mock.Anything, mock.Anything).Return(nil)

	accountSvc := NewAccountService(mockRepo)

	ctx := context.Background()
	id := "testID"
	err := accountSvc.DeleteAccount(ctx, id)

	mockRepo.AssertExpectations(t)
	assert.NoError(t, err, "DeleteAccount should not return an error")
}

func TestFindAll(t *testing.T) {
	mockRepo := &MockAccountRepository{}

	expectedAccounts := []*account.Account{}
	for i := 0; i < 10; i++ {
		expectedAccounts = append(expectedAccounts, utils.GetNewRandomAccount())
	}
	mockRepo.On("FindAll", mock.Anything).Return(expectedAccounts, nil)

	accountSvc := NewAccountService(mockRepo)

	ctx := context.Background()
	accounts, err := accountSvc.FindAll(ctx, "1")

	mockRepo.AssertExpectations(t)
	assert.NoError(t, err, "FindAll should not return an error")
	assert.Equal(t, expectedAccounts, accounts, "Returned accounts should match expected")
}
