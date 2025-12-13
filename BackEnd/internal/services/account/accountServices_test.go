package account

import (
	"context"
	"testing"

	"github.com/osmait/gestorDePresupuesto/internal/domain/account"
	"github.com/osmait/gestorDePresupuesto/internal/platform/utils"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

type MockAccountRepository struct {
	mock.Mock
}

func (m *MockAccountRepository) Save(ctx context.Context, acc *account.Account) error {
	args := m.Called(ctx, acc)
	return args.Error(0)
}

func (m *MockAccountRepository) FindAll(ctx context.Context, userId string) ([]*account.Account, error) {
	args := m.Called(ctx, userId)
	return args.Get(0).([]*account.Account), args.Error(1)
}

func (m *MockAccountRepository) Delete(ctx context.Context, id string, userId string) error {
	args := m.Called(ctx, id, userId)
	return args.Error(0)
}

func (m *MockAccountRepository) Balance(ctx context.Context, id string) (float64, error) {
	args := m.Called(ctx, id)
	return args.Get(0).(float64), args.Error(1)
}

func (m *MockAccountRepository) Balances(ctx context.Context, userId string) (map[string]float64, error) {
	args := m.Called(ctx, userId)
	return args.Get(0).(map[string]float64), args.Error(1)
}

func (m *MockAccountRepository) Update(ctx context.Context, id string, name string, bank string, userId string) error {
	args := m.Called(ctx, id, name, bank, userId)
	return args.Error(0)
}

func (m *MockAccountRepository) FindByIdAndUserId(ctx context.Context, id string, userId string) (*account.Account, error) {
	args := m.Called(ctx, id, userId)
	return args.Get(0).(*account.Account), args.Error(1)
}

func TestCreateAccount(t *testing.T) {
	mockRepo := &MockAccountRepository{}

	accountSvc := NewAccountService(mockRepo)

	ctx := context.Background()

	mockRepo.On("Save", ctx, mock.AnythingOfType("*account.Account")).Return(nil)

	account := utils.GetNewRandomAccount()

	err := accountSvc.CreateAccount(ctx, account.Name, account.Bank, account.InitialBalance, account.Id)

	assert.NoError(t, err, "CreateAccount should not return an error")

	mockRepo.AssertExpectations(t)
}

func TestDeleteAccount(t *testing.T) {
	mockRepo := &MockAccountRepository{}

	mockRepo.On("Delete", mock.Anything, mock.Anything, mock.Anything).Return(nil)

	accountSvc := NewAccountService(mockRepo)

	ctx := context.Background()
	id := "testID"
	userId := "testUserID"
	err := accountSvc.DeleteAccount(ctx, id, userId)

	mockRepo.AssertExpectations(t)
	assert.NoError(t, err, "DeleteAccount should not return an error")
}

func TestFindAll(t *testing.T) {
	mockRepo := &MockAccountRepository{}

	expectedAccounts := []*account.Account{}
	expectedBalances := make(map[string]float64)
	for i := 0; i < 10; i++ {
		acc := utils.GetNewRandomAccount()
		expectedAccounts = append(expectedAccounts, acc)
		expectedBalances[acc.Id] = 1000.00
	}

	mockRepo.On("Balances", context.Background(), mock.Anything).Return(expectedBalances, nil)
	mockRepo.On("FindAll", mock.Anything, mock.Anything).Return(expectedAccounts, nil)

	accountSvc := NewAccountService(mockRepo)

	ctx := context.Background()
	_, err := accountSvc.FindAll(ctx, "1")

	mockRepo.AssertExpectations(t)
	assert.NoError(t, err, "FindAll should not return an error")
}
