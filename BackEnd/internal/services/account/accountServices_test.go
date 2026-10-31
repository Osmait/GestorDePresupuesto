package account

import (
	"context"
	"testing"

	"github.com/osmait/gestorDePresupuesto/internal/domain/account"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
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

func (m *MockAccountRepository) Balance(ctx context.Context, id string, userId string) (money.Amount, error) {
	args := m.Called(ctx, id, userId)
	return args.Get(0).(money.Amount), args.Error(1)
}

func (m *MockAccountRepository) BalanceByCurrency(ctx context.Context, id string, userId string, currency string) (money.Amount, error) {
	args := m.Called(ctx, id, userId, currency)
	return args.Get(0).(money.Amount), args.Error(1)
}

func (m *MockAccountRepository) BalancesByCurrency(ctx context.Context, ids []string, userId string) (map[string]map[string]money.Amount, error) {
	args := m.Called(ctx, ids, userId)
	return args.Get(0).(map[string]map[string]money.Amount), args.Error(1)
}

func (m *MockAccountRepository) Balances(ctx context.Context, userId string) (map[string]money.Amount, error) {
	args := m.Called(ctx, userId)
	return args.Get(0).(map[string]money.Amount), args.Error(1)
}

func (m *MockAccountRepository) Update(ctx context.Context, id string, name string, bank string, userId string) error {
	args := m.Called(ctx, id, name, bank, userId)
	return args.Error(0)
}

func (m *MockAccountRepository) FindByIdAndUserId(ctx context.Context, id string, userId string) (*account.Account, error) {
	args := m.Called(ctx, id, userId)
	return args.Get(0).(*account.Account), args.Error(1)
}

func (m *MockAccountRepository) FindByIdAndUserIdForUpdate(ctx context.Context, id string, userId string) (*account.Account, error) {
	args := m.Called(ctx, id, userId)
	return args.Get(0).(*account.Account), args.Error(1)
}

func (m *MockAccountRepository) Search(ctx context.Context, userId string, query string) ([]*account.Account, error) {
	args := m.Called(ctx, userId, query)
	return args.Get(0).([]*account.Account), args.Error(1)
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
	expectedBalances := make(map[string]money.Amount)
	for i := 0; i < 10; i++ {
		acc := utils.GetNewRandomAccount()
		expectedAccounts = append(expectedAccounts, acc)
		expectedBalances[acc.Id] = money.FromInt(1000)
	}

	mockRepo.On("Balances", context.Background(), mock.Anything).Return(expectedBalances, nil)
	mockRepo.On("FindAll", mock.Anything, mock.Anything).Return(expectedAccounts, nil)

	accountSvc := NewAccountService(mockRepo)

	ctx := context.Background()
	_, err := accountSvc.FindAll(ctx, "1")

	mockRepo.AssertExpectations(t)
	assert.NoError(t, err, "FindAll should not return an error")
}

// A credit card's balance in the list is its ledger in its primary currency,
// read for every card in one BalancesByCurrency call; a card without
// transactions in that currency shows its initial balance.
func TestFindAll_CardBalancesInOneLookup(t *testing.T) {
	mockRepo := &MockAccountRepository{}

	bank := utils.GetNewRandomAccount()
	usdCard := account.NewCreditCardAccount("card-usd", "Visa", "Bank")
	usdCard.Currency = "usd"
	dopCard := account.NewCreditCardAccount("card-dop", "Master", "Bank")
	emptyCard := account.NewCreditCardAccount("card-empty", "Amex", "Bank")
	accounts := []*account.Account{bank, usdCard, dopCard, emptyCard}

	mockRepo.On("FindAll", mock.Anything, "user-1").Return(accounts, nil)
	mockRepo.On("Balances", mock.Anything, "user-1").Return(map[string]money.Amount{
		bank.Id: money.FromInt(250), usdCard.Id: money.FromInt(-999), dopCard.Id: money.FromInt(-999),
	}, nil)
	mockRepo.On("BalancesByCurrency", mock.Anything, []string{usdCard.Id, dopCard.Id, emptyCard.Id}, "user-1").
		Return(map[string]map[string]money.Amount{
			usdCard.Id: {"USD": money.FromInt(-40), "DOP": money.FromInt(-7)},
			dopCard.Id: {"DOP": money.FromInt(-300)},
		}, nil).Once()

	got, err := NewAccountService(mockRepo).FindAll(context.Background(), "user-1")
	assert.NoError(t, err)
	mockRepo.AssertExpectations(t)

	balances := map[string]string{}
	for _, r := range got {
		balances[r.AccountInfo.Id] = r.CurrentBalance.StringFixed(2)
	}
	assert.Equal(t, map[string]string{
		bank.Id:      bank.InitialBalance.Add(money.FromInt(250)).StringFixed(2),
		usdCard.Id:   "-40.00",
		dopCard.Id:   "-300.00",
		emptyCard.Id: "0.00",
	}, balances)
}

// Without credit cards there is nothing to look up per currency.
func TestFindAll_NoCardsSkipsCurrencyLookup(t *testing.T) {
	mockRepo := &MockAccountRepository{}
	mockRepo.On("FindAll", mock.Anything, "user-1").Return([]*account.Account{utils.GetNewRandomAccount()}, nil)
	mockRepo.On("Balances", mock.Anything, "user-1").Return(map[string]money.Amount{}, nil)

	_, err := NewAccountService(mockRepo).FindAll(context.Background(), "user-1")
	assert.NoError(t, err)
	mockRepo.AssertNotCalled(t, "BalancesByCurrency", mock.Anything, mock.Anything, mock.Anything)
}
