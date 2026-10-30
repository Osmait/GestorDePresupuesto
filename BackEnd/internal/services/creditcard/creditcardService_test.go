package creditcard

import (
	"context"
	"errors"
	"net/http"
	"testing"
	"time"

	"github.com/osmait/gestorDePresupuesto/internal/domain/account"
	creditcardDomain "github.com/osmait/gestorDePresupuesto/internal/domain/creditcard"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
	dto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/creditcard"
	apperrors "github.com/osmait/gestorDePresupuesto/internal/platform/errors"
	"github.com/osmait/gestorDePresupuesto/internal/platform/i18n"
	cardStorage "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/creditcard"
	"github.com/osmait/gestorDePresupuesto/internal/services/funds"
)

type mockCreditCardRepo struct {
	balance          *creditcardDomain.CardBalance
	card             *creditcardDomain.CreditCard
	lastSavedPayment *creditcardDomain.CardPayment
	deletedPaymentID string
	categoryUserIDs  []string
}

func (m *mockCreditCardRepo) EnsurePaymentCategory(_ context.Context, userId string) (string, error) {
	m.categoryUserIDs = append(m.categoryUserIDs, userId)
	return "cpcat-" + userId, nil
}

func (m *mockCreditCardRepo) EnsureAdjustmentCategory(_ context.Context, userId string) (string, error) {
	return "adjcat-" + userId, nil
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

func (m *mockCreditCardRepo) FindAllCards(context.Context, string) ([]*creditcardDomain.CreditCard, error) {
	return nil, nil
}
func (m *mockCreditCardRepo) UpdateCard(context.Context, *creditcardDomain.CreditCard, string) error {
	return nil
}
func (m *mockCreditCardRepo) DeleteCard(context.Context, string, string) error { return nil }
func (m *mockCreditCardRepo) DeleteBookkeeping(context.Context, string, string) error {
	return nil
}
func (m *mockCreditCardRepo) SaveBalance(context.Context, *creditcardDomain.CardBalance) error {
	return nil
}
func (m *mockCreditCardRepo) FindBalanceById(context.Context, string, string) (*creditcardDomain.CardBalance, error) {
	return nil, nil
}
func (m *mockCreditCardRepo) FindBalancesByCard(context.Context, string, string) ([]*creditcardDomain.CardBalance, error) {
	return nil, nil
}
func (m *mockCreditCardRepo) FindBalanceByCardAndCurrency(_ context.Context, _ string, _ string, _ string) (*creditcardDomain.CardBalance, error) {
	if m.balance == nil {
		return nil, errors.New("balance not found")
	}
	balanceCopy := *m.balance
	return &balanceCopy, nil
}
func (m *mockCreditCardRepo) UpdateCreditLimit(_ context.Context, _ string, _ string, creditLimit money.Amount) (*creditcardDomain.CardBalance, error) {
	m.balance.CreditLimit = creditLimit
	balanceCopy := *m.balance
	return &balanceCopy, nil
}

func (m *mockCreditCardRepo) DeleteBalance(context.Context, string, string) error { return nil }
func (m *mockCreditCardRepo) SavePayment(_ context.Context, payment *creditcardDomain.CardPayment, _ string) error {
	m.lastSavedPayment = payment
	return nil
}
func (m *mockCreditCardRepo) DeletePayment(_ context.Context, id string, _ string) error {
	m.deletedPaymentID = id
	return nil
}
func (m *mockCreditCardRepo) FindPaymentById(context.Context, string, string) (*creditcardDomain.CardPayment, error) {
	return nil, nil
}
func (m *mockCreditCardRepo) FindPaymentsByCard(context.Context, string, string) ([]*creditcardDomain.CardPayment, error) {
	return nil, nil
}
func (m *mockCreditCardRepo) FindPaymentsByCardAndCurrency(context.Context, string, string, string) ([]*creditcardDomain.CardPayment, error) {
	return nil, nil
}
func (m *mockCreditCardRepo) GetTotalPaymentsByCardAndCurrency(context.Context, string, string, string) (money.Amount, error) {
	return money.Zero, nil
}
func (m *mockCreditCardRepo) SaveBalanceReset(context.Context, *creditcardDomain.CardBalanceReset) error {
	return nil
}
func (m *mockCreditCardRepo) FindBalanceResetsByCard(context.Context, string, string) ([]*creditcardDomain.CardBalanceReset, error) {
	return nil, nil
}

type mockAccountRepo struct {
	account *account.Account
	// movements is the net transaction total returned by Balance; nil means
	// the account holds plenty of money (1,000,000).
	movements   *money.Amount
	lockedForID []string
}

func (m *mockAccountRepo) FindByIdAndUserIdForUpdate(ctx context.Context, id string, userId string) (*account.Account, error) {
	m.lockedForID = append(m.lockedForID, id)
	return m.FindByIdAndUserId(ctx, id, userId)
}
func (m *mockAccountRepo) Balance(context.Context, string, string) (money.Amount, error) {
	if m.movements == nil {
		return money.FromInt(1_000_000), nil
	}
	return *m.movements, nil
}

func (m *mockAccountRepo) Save(context.Context, *account.Account) error { return nil }
func (m *mockAccountRepo) FindByIdAndUserId(_ context.Context, _ string, _ string) (*account.Account, error) {
	if m.account == nil {
		return nil, errors.New("account not found")
	}
	return m.account, nil
}
func (m *mockAccountRepo) Delete(context.Context, string, string) error { return nil }
func (m *mockAccountRepo) BalanceByCurrency(context.Context, string, string, string) (money.Amount, error) {
	return money.Zero, nil
}

type transactionCall struct {
	accountID       string
	name            string
	description     string
	categoryID      string
	typeTransaction string
	amount          money.Amount
	currency        string
}

type mockTransactionService struct {
	calls     []transactionCall
	failMain  bool
	deletedID string
}

func (m *mockTransactionService) CreateTransaction(context.Context, string, string, money.Amount, string, string, string, string, string, string, time.Time) error {
	return nil
}

func (m *mockTransactionService) CreateTransactionWithID(_ context.Context, name, description string, amount money.Amount, typeTransaction string, accountID string, _ string, categoryID string, _ string, currency string, _ time.Time) (string, error) {
	m.calls = append(m.calls, transactionCall{
		accountID:       accountID,
		name:            name,
		description:     description,
		categoryID:      categoryID,
		typeTransaction: typeTransaction,
		amount:          amount,
		currency:        currency,
	})
	if m.failMain && name == i18n.TL(i18n.ES, i18n.CardPaymentName) {
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
		balance: &creditcardDomain.CardBalance{Id: "bal-1", CardId: "card-1", Currency: "DOP", CurrentBalance: money.FromInt(-500), CreditLimit: money.FromInt(1000)},
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
		Amount:           money.FromInt(100),
		IncludesInterest: true,
		InterestAmount:   money.FromInt(10),
	}

	_, err := service.CreatePayment(context.Background(), "card-1", "user-1", req)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if cardRepo.deletedPaymentID != "" {
		t.Fatalf("expected no payment rollback, got delete id %s", cardRepo.deletedPaymentID)
	}

	// The payment is a transfer: money out of the paying account, debt down on
	// the card; the interest is an expense of the paying account.
	want := []transactionCall{
		{accountID: "acc-1", typeTransaction: "card_payment", amount: money.FromInt(100), currency: "DOP"},
		{accountID: "card-1", typeTransaction: creditcardDomain.PaymentReceivedType, amount: money.FromInt(100), currency: "DOP"},
		{accountID: "acc-1", typeTransaction: "bill", amount: money.FromInt(10), currency: "DOP"},
	}
	if len(txRepo.calls) != len(want) {
		t.Fatalf("expected %d transaction calls, got %+v", len(want), txRepo.calls)
	}
	for i, w := range want {
		c := txRepo.calls[i]
		if c.accountID != w.accountID || c.typeTransaction != w.typeTransaction || !c.amount.Equal(w.amount) || c.currency != w.currency {
			t.Fatalf("call %d = %+v, want %+v", i, c, w)
		}
	}
}

// Card payments must not land in the repository's fallback category (the
// user's oldest one, e.g. "Supermercado"): they use the dedicated card payment
// category of the paying user.
func TestCreatePayment_UsesDedicatedPaymentCategory(t *testing.T) {
	cardRepo := &mockCreditCardRepo{
		balance: &creditcardDomain.CardBalance{Id: "bal-1", CardId: "card-1", Currency: "DOP", CurrentBalance: money.FromInt(-500), CreditLimit: money.FromInt(1000)},
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
		Amount:           money.FromInt(100),
		IncludesInterest: true,
		InterestAmount:   money.FromInt(10),
	}

	if _, err := service.CreatePayment(context.Background(), "card-1", "user-1", req); err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	if len(cardRepo.categoryUserIDs) != 1 || cardRepo.categoryUserIDs[0] != "user-1" {
		t.Fatalf("expected the payment category to be resolved once for user-1, got %v", cardRepo.categoryUserIDs)
	}
	for _, call := range txRepo.calls {
		if call.categoryID != "cpcat-user-1" {
			t.Fatalf("expected %q to use the card payment category, got %q", call.name, call.categoryID)
		}
	}
}

func TestPaymentCategoryID_MatchesBackfillMigration(t *testing.T) {
	// migration 000030: 'cpcat_' || SUBSTRING(MD5(user_id) FROM 1 FOR 26)
	if got := cardStorage.PaymentCategoryID("user-1"); got != "cpcat_d6d7705392bc7af633328bea8c" {
		t.Fatalf("unexpected payment category id %q", got)
	}
	if cardStorage.PaymentCategoryID("user-1") == cardStorage.PaymentCategoryID("user-2") {
		t.Fatalf("payment category id must be per user")
	}
}

// The generated transaction names follow the request locale (Spanish by
// default, with accents), while the category stays the same deterministic one.
func TestCreatePayment_LocalizesGeneratedNames(t *testing.T) {
	cases := []struct {
		name         string
		ctx          context.Context
		wantName     string
		wantDesc     string
		wantReceived string
		wantInterest string
	}{
		{"default is spanish", context.Background(), "Pago de tarjeta", "Pago a tarjeta BHD - nota", "Pago recibido", "Cargo por intereses"},
		{"spanish", i18n.WithLocale(context.Background(), i18n.ES), "Pago de tarjeta", "Pago a tarjeta BHD - nota", "Pago recibido", "Cargo por intereses"},
		{"english", i18n.WithLocale(context.Background(), i18n.EN), "Card payment", "Payment to BHD card - nota", "Payment received", "Interest charge"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			cardRepo := &mockCreditCardRepo{
				balance: &creditcardDomain.CardBalance{Id: "bal-1", CardId: "card-1", Currency: "DOP", CurrentBalance: money.FromInt(-500), CreditLimit: money.FromInt(1000)},
				card:    &creditcardDomain.CreditCard{AccountId: "card-1", Bank: "BHD"},
			}
			accountRepo := &mockAccountRepo{account: &account.Account{Id: "acc-1", UserId: "user-1", Currency: "DOP"}}
			txRepo := &mockTransactionService{}
			service := NewCreditCardService(cardRepo, accountRepo, txRepo)

			_, err := service.CreatePayment(tc.ctx, "card-1", "user-1", &dto.CreatePaymentRequest{
				FromAccountId: "acc-1", Currency: "DOP", Amount: money.FromInt(100), Notes: "nota",
				IncludesInterest: true, InterestAmount: money.FromInt(10),
			})
			if err != nil {
				t.Fatalf("expected no error, got %v", err)
			}
			if len(txRepo.calls) != 3 {
				t.Fatalf("expected 3 transaction calls, got %d", len(txRepo.calls))
			}
			if txRepo.calls[0].name != tc.wantName || txRepo.calls[0].description != tc.wantDesc {
				t.Fatalf("payment transaction = %q / %q, want %q / %q", txRepo.calls[0].name, txRepo.calls[0].description, tc.wantName, tc.wantDesc)
			}
			if txRepo.calls[1].name != tc.wantReceived {
				t.Fatalf("received transaction = %q, want %q", txRepo.calls[1].name, tc.wantReceived)
			}
			if txRepo.calls[2].name != tc.wantInterest {
				t.Fatalf("interest transaction = %q, want %q", txRepo.calls[2].name, tc.wantInterest)
			}
			for _, call := range txRepo.calls {
				if call.categoryID != "cpcat-user-1" {
					t.Fatalf("category must not depend on the locale, got %q", call.categoryID)
				}
			}
		})
	}
}

func newOverdraftFixture(initial, movements string) (*mockCreditCardRepo, *mockAccountRepo, *mockTransactionService, *CreditCardService) {
	cardRepo := &mockCreditCardRepo{
		balance: &creditcardDomain.CardBalance{Id: "bal-1", CardId: "card-1", Currency: "DOP", CurrentBalance: money.FromInt(-5000), CreditLimit: money.FromInt(10000)},
		card:    &creditcardDomain.CreditCard{AccountId: "card-1", Bank: "BHD"},
	}
	mv := money.MustParse(movements)
	accountRepo := &mockAccountRepo{
		account:   &account.Account{Id: "acc-1", UserId: "user-1", Currency: "DOP", InitialBalance: money.MustParse(initial)},
		movements: &mv,
	}
	txRepo := &mockTransactionService{}
	return cardRepo, accountRepo, txRepo, NewCreditCardService(cardRepo, accountRepo, txRepo)
}

// A payment larger than the paying account's current balance (initial balance
// + transactions, as the accounts API reports it) is rejected with
// INSUFFICIENT_FUNDS before anything is written.
func TestCreatePayment_RejectsOverdraft(t *testing.T) {
	cardRepo, accountRepo, txRepo, service := newOverdraftFixture("100", "-50") // 50.00 available

	_, err := service.CreatePayment(context.Background(), "card-1", "user-1", &dto.CreatePaymentRequest{
		FromAccountId: "acc-1", Currency: "DOP", Amount: money.MustParse("50.01"),
	})
	if !errors.Is(err, funds.ErrInsufficientFunds) {
		t.Fatalf("expected ErrInsufficientFunds, got %v", err)
	}
	appErr, ok := apperrors.AsAppError(err)
	if !ok || appErr.Code != funds.InsufficientFundsCode || appErr.ToHTTPStatus() != http.StatusBadRequest {
		t.Fatalf("expected 400 %s, got %#v", funds.InsufficientFundsCode, appErr)
	}
	if cardRepo.lastSavedPayment != nil || len(txRepo.calls) != 0 {
		t.Fatalf("nothing must be written on overdraft")
	}
	if len(accountRepo.lockedForID) != 1 || accountRepo.lockedForID[0] != "acc-1" {
		t.Fatalf("expected the paying account to be locked, got %v", accountRepo.lockedForID)
	}
}

func TestCreatePayment_AllowsPaymentOfExactBalance(t *testing.T) {
	_, _, txRepo, service := newOverdraftFixture("100", "-50")

	if _, err := service.CreatePayment(context.Background(), "card-1", "user-1", &dto.CreatePaymentRequest{
		FromAccountId: "acc-1", Currency: "DOP", Amount: money.MustParse("50.00"),
	}); err != nil {
		t.Fatalf("expected the payment to pass, got %v", err)
	}
	// card_payment on the paying account + card_payment_received on the card.
	if len(txRepo.calls) != 2 {
		t.Fatalf("expected 2 ledger transactions, got %d", len(txRepo.calls))
	}
}

// The interest debited with the payment counts towards the required funds.
func TestCreatePayment_OverdraftCountsInterest(t *testing.T) {
	_, _, _, service := newOverdraftFixture("100", "0")

	_, err := service.CreatePayment(context.Background(), "card-1", "user-1", &dto.CreatePaymentRequest{
		FromAccountId: "acc-1", Currency: "DOP", Amount: money.FromInt(95),
		IncludesInterest: true, InterestAmount: money.FromInt(10),
	})
	if !errors.Is(err, funds.ErrInsufficientFunds) {
		t.Fatalf("expected ErrInsufficientFunds, got %v", err)
	}
}

// card_payments.amount is DECIMAL(15,2): 0.001 must be rejected, not rounded.
func TestCreatePayment_RejectsSubCentAmount(t *testing.T) {
	cardRepo, _, _, service := newOverdraftFixture("100", "0")

	_, err := service.CreatePayment(context.Background(), "card-1", "user-1", &dto.CreatePaymentRequest{
		FromAccountId: "acc-1", Currency: "DOP", Amount: money.MustParse("0.001"),
	})
	if !errors.Is(err, money.ErrTooManyDecimals) {
		t.Fatalf("expected ErrTooManyDecimals, got %v", err)
	}
	if cardRepo.lastSavedPayment != nil {
		t.Fatalf("payment must not be saved")
	}
}
