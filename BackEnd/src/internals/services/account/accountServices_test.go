package account

import (
	"context"
	"testing"

	"github.com/osmait/gestorDePresupuesto/src/internals/domain/account"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// Mock de AccountRepository
type MockAccountRepository struct {
	mock.Mock
}

func (m *MockAccountRepository) Save(ctx context.Context, acc account.Account) error {
	args := m.Called(ctx, acc)
	return args.Error(0)
}

func (m *MockAccountRepository) FindAll(ctx context.Context) ([]*account.Account, error) {
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
	// Crea una instancia del MockAccountRepository
	// Create a mock implementation of AccountRepository for testing
	mockRepo := &MockAccountRepository{} // You need to define this mock in your tests

	// Create an instance of AccountService with the mock repository
	accountSvc := NewAccountService(mockRepo)

	// Define the test input parameters
	ctx := context.Background()
	id := "testID"
	name := "Test Name"
	bank := "Test Bank"
	balance := 100.0

	// Expectation: Save method on the mock repository is called
	mockRepo.On("Save", ctx, mock.AnythingOfType("account.Account")).Return(nil)

	// Call the method being tested
	err := accountSvc.CreateAccount(ctx, id, name, bank, balance)

	// Assertions
	assert.NoError(t, err, "CreateAccount should not return an error")

	// Assert that the mock repository's Save method was called with the correct arguments
	mockRepo.AssertExpectations(t)
}

func TestDeleteAccount(t *testing.T) {
	mockRepo := &MockAccountRepository{}

	// Configura el comportamientosperado del mock
	// o algún otro error si deseas simularlo
	mockRepo.On("Delete", mock.Anything, mock.Anything).Return(nil)

	// Crea una instancia de AccountService con el mock de repositorio
	accountSvc := NewAccountService(mockRepo)

	// Llama al método que estás probando
	ctx := context.Background()
	id := "testID"
	err := accountSvc.DeleteAccount(ctx, id)

	// Asegura que el método del mock haya sido llamado y verifica el resultado
	mockRepo.AssertExpectations(t)
	assert.NoError(t, err, "DeleteAccount should not return an error")
}

func TestFindAll(t *testing.T) {
	// Crea una instancia del mock de AccountRepository
	mockRepo := &MockAccountRepository{}

	// Configura el comportamiento esperado del mock
	expectedAccounts := []*account.Account{
		{Id: "1", Name: "Account 1", Bank: "Bank 1", InitialBalance: 100.0},
		{Id: "2", Name: "Account 2", Bank: "Bank 2", InitialBalance: 200.0},
	}
	mockRepo.On("FindAll", mock.Anything).Return(expectedAccounts, nil)

	// Crea una instancia de AccountService con el mock de repositorio
	accountSvc := NewAccountService(mockRepo)

	// Llama al método que estás probando
	ctx := context.Background()
	accounts, err := accountSvc.FindAll(ctx)

	// Asegura que el método del mock haya sido llamado y verifica el resultado
	mockRepo.AssertExpectations(t)
	assert.NoError(t, err, "FindAll should not return an error")
	assert.Equal(t, expectedAccounts, accounts, "Returned accounts should match expected")
}
