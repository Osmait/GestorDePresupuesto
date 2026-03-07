package creditcard

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/osmait/gestorDePresupuesto/internal/domain/account"
	creditcardDomain "github.com/osmait/gestorDePresupuesto/internal/domain/creditcard"
	dto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/creditcard"
)

type mockCreditCardRepo struct {
	balance           *creditcardDomain.CardBalance
	card              *creditcardDomain.CreditCard
	lastSavedPayment  *creditcardDomain.CardPayment
	deletedPaymentID  string
	updateBalanceCall int
	updatedBalances   []float64
}

func (m *mockCreditCardRepo) SaveCard(context.Context, *creditcardDomain.CreditCard) error {
	return nil
}
func (m *mockCreditCardRepo) FindCardById(_ context.Context, accountId string, _ string) (*creditcardDomain.CreditCard, error) {
	if m.card != nil {
		return m.card, nil
	}
	return &creditcardDomain.CreditCard{AccountId: accountId, Bank: "Test Bank"}, nil
}
func (m *mockCreditCardRepo) FindCardByAccountId(context.Context, string) (*creditcardDomain.CreditCard, error) {
	return nil, nil
}
func (m *mockCreditCardRepo) FindAllCards(context.Context, string) ([]*creditcardDomain.CreditCard, error) {
	return nil, nil
}
func (m *mockCreditCardRepo) UpdateCard(context.Context, *creditcardDomain.CreditCard) error {
	return nil
}
func (m *mockCreditCardRepo) DeleteCard(context.Context, string, string) error { return nil }
func (m *mockCreditCardRepo) SaveBalance(context.Context, *creditcardDomain.CardBalance) error {
	return nil
}
func (m *mockCreditCardRepo) FindBalanceById(context.Context, string) (*creditcardDomain.CardBalance, error) {
	return nil, nil
}
func (m *mockCreditCardRepo) FindBalancesByCard(context.Context, string) ([]*creditcardDomain.CardBalance, error) {
	return nil, nil
}
func (m *mockCreditCardRepo) FindBalanceByCardAndCurrency(_ context.Context, _ string, _ string) (*creditcardDomain.CardBalance, error) {
	if m.balance == nil {
		return nil, errors.New("balance not found")
	}
	balanceCopy := *m.balance
	return &balanceCopy, nil
}
func (m *mockCreditCardRepo) UpdateBalance(_ context.Context, balance *creditcardDomain.CardBalance) error {
	m.updateBalanceCall++
	m.updatedBalances = append(m.updatedBalances, balance.CurrentBalance)
	m.balance = balance
	return nil
}
func (m *mockCreditCardRepo) UpdateBalanceByAmount(context.Context, string, string, float64) error {
	return nil
}
func (m *mockCreditCardRepo) DeleteBalance(context.Context, string) error { return nil }
func (m *mockCreditCardRepo) SavePayment(_ context.Context, payment *creditcardDomain.CardPayment) error {
	m.lastSavedPayment = payment
	return nil
}
func (m *mockCreditCardRepo) DeletePayment(_ context.Context, id string) error {
	m.deletedPaymentID = id
	return nil
}
func (m *mockCreditCardRepo) FindPaymentById(context.Context, string) (*creditcardDomain.CardPayment, error) {
	return nil, nil
}
func (m *mockCreditCardRepo) FindPaymentsByCard(context.Context, string) ([]*creditcardDomain.CardPayment, error) {
	return nil, nil
}
func (m *mockCreditCardRepo) FindPaymentsByCardAndCurrency(context.Context, string, string) ([]*creditcardDomain.CardPayment, error) {
	return nil, nil
}
func (m *mockCreditCardRepo) GetTotalPaymentsByCardAndCurrency(context.Context, string, string) (float64, error) {
	return 0, nil
}

type mockAccountRepo struct {
	account *account.Account
}

func (m *mockAccountRepo) Save(context.Context, *account.Account) error { return nil }
func (m *mockAccountRepo) FindByIdAndUserId(_ context.Context, _ string, _ string) (*account.Account, error) {
	if m.account == nil {
		return nil, errors.New("account not found")
	}
	return m.account, nil
}
func (m *mockAccountRepo) Delete(context.Context, string, string) error { return nil }
func (m *mockAccountRepo) BalanceByCurrency(context.Context, string, string) (float64, error) {
	return 0, nil
}

type transactionCall struct {
	name            string
	typeTransaction string
	amount          float64
	currency        string
}

type mockTransactionService struct {
	calls     []transactionCall
	failMain  bool
	deletedID string
}

func (m *mockTransactionService) CreateTransaction(context.Context, string, string, float64, string, string, string, string, string, string, time.Time) error {
	return nil
}

func (m *mockTransactionService) CreateTransactionWithID(_ context.Context, name, _ string, amount float64, typeTransaction string, _ string, _ string, _ string, _ string, currency string, _ time.Time) (string, error) {
	m.calls = append(m.calls, transactionCall{
		name:            name,
		typeTransaction: typeTransaction,
		amount:          amount,
		currency:        currency,
	})
	if m.failMain && name == "Card Payment" {
		return "", errors.New("failed to create transaction")
	}
	return "tx-id", nil
}

func (m *mockTransactionService) DeleteTransaction(_ context.Context, id string, _ string) error {
	m.deletedID = id
	return nil
}

func TestCreatePayment_UsesCardPaymentTypeAndInterestAsBill(t *testing.T) {
	cardRepo := &mockCreditCardRepo{
		balance: &creditcardDomain.CardBalance{Id: "bal-1", CardId: "card-1", Currency: "DOP", CurrentBalance: -500, CreditLimit: 1000},
		card:    &creditcardDomain.CreditCard{AccountId: "card-1", Bank: "BHD"},
	}
	accountRepo := &mockAccountRepo{
		account: &account.Account{Id: "acc-1", UserId: "user-1", Currency: "DOP"},
	}
	txRepo := &mockTransactionService{}
	service := NewCreditCardService(cardRepo, accountRepo, txRepo)

	req := &dto.CreatePaymentRequest{
		FromAccountId:    "acc-1",
		Currency:         "DOP",
		Amount:           100,
		IncludesInterest: true,
		InterestAmount:   10,
	}

	_, err := service.CreatePayment(context.Background(), "card-1", "user-1", req)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if cardRepo.updateBalanceCall != 1 {
		t.Fatalf("expected 1 balance update, got %d", cardRepo.updateBalanceCall)
	}
	if len(cardRepo.updatedBalances) == 0 || cardRepo.updatedBalances[0] != -400 {
		t.Fatalf("expected updated card balance to be -400, got %v", cardRepo.updatedBalances)
	}
	if cardRepo.deletedPaymentID != "" {
		t.Fatalf("expected no payment rollback, got delete id %s", cardRepo.deletedPaymentID)
	}

	if len(txRepo.calls) != 2 {
		t.Fatalf("expected 2 transaction calls, got %d", len(txRepo.calls))
	}
	if txRepo.calls[0].typeTransaction != "card_payment" {
		t.Fatalf("expected first transaction type card_payment, got %s", txRepo.calls[0].typeTransaction)
	}
	if txRepo.calls[1].typeTransaction != "bill" {
		t.Fatalf("expected interest transaction type bill, got %s", txRepo.calls[1].typeTransaction)
	}
}

func TestCreatePayment_RollsBackWhenMainTransactionFails(t *testing.T) {
	cardRepo := &mockCreditCardRepo{
		balance: &creditcardDomain.CardBalance{Id: "bal-1", CardId: "card-1", Currency: "DOP", CurrentBalance: -500, CreditLimit: 1000},
		card:    &creditcardDomain.CreditCard{AccountId: "card-1", Bank: "BHD"},
	}
	accountRepo := &mockAccountRepo{
		account: &account.Account{Id: "acc-1", UserId: "user-1", Currency: "DOP"},
	}
	txRepo := &mockTransactionService{failMain: true}
	service := NewCreditCardService(cardRepo, accountRepo, txRepo)

	req := &dto.CreatePaymentRequest{
		FromAccountId: "acc-1",
		Currency:      "DOP",
		Amount:        100,
	}

	_, err := service.CreatePayment(context.Background(), "card-1", "user-1", req)
	if err == nil {
		t.Fatal("expected error when main transaction fails")
	}

	if cardRepo.lastSavedPayment == nil {
		t.Fatal("expected payment to be saved before rollback")
	}
	if cardRepo.deletedPaymentID == "" {
		t.Fatal("expected saved payment to be rolled back")
	}
	if cardRepo.deletedPaymentID != cardRepo.lastSavedPayment.Id {
		t.Fatalf("expected rollback payment id %s, got %s", cardRepo.lastSavedPayment.Id, cardRepo.deletedPaymentID)
	}
	if len(cardRepo.updatedBalances) != 2 {
		t.Fatalf("expected 2 balance updates (apply + rollback), got %d", len(cardRepo.updatedBalances))
	}
	if cardRepo.updatedBalances[0] != -400 || cardRepo.updatedBalances[1] != -500 {
		t.Fatalf("unexpected balance updates sequence: %v", cardRepo.updatedBalances)
	}
}
