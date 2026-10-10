package postgress

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/osmait/gestorDePresupuesto/internal/domain/account"
	"github.com/osmait/gestorDePresupuesto/internal/domain/category"
	"github.com/osmait/gestorDePresupuesto/internal/domain/creditcard"
	"github.com/osmait/gestorDePresupuesto/internal/domain/investment"
	"github.com/osmait/gestorDePresupuesto/internal/domain/loan"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money/moneytest"
	"github.com/osmait/gestorDePresupuesto/internal/domain/transaction"
	creditcardDto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/creditcard"
	loanDto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/loan"
	accountRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/account"
	categoryRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/category"
	creditcardRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/creditcard"
	investmentRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/investment"
	loanRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/loan"
	transactionRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/transaction"
	"github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/txhelper"
	userRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/user"
	"github.com/osmait/gestorDePresupuesto/internal/platform/utils"
	creditcardService "github.com/osmait/gestorDePresupuesto/internal/services/creditcard"
	loanService "github.com/osmait/gestorDePresupuesto/internal/services/loan"
)

// inRequestTx runs fn the way an HTTP request does: inside one transaction
// carried by the context (RLSMiddleware stores it with txhelper.WithTx),
// committed when fn succeeds and rolled back when it returns an error.
func inRequestTx(ctx context.Context, db *sql.DB, fn func(ctx context.Context) error) error {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	if err := fn(txhelper.WithTx(ctx, tx)); err != nil {
		_ = tx.Rollback()
		return err
	}
	return tx.Commit()
}

// ledgerTransactionService writes the payment's ledger transactions through
// the real repository, so they take part in the request transaction. It fails
// when the description contains "FAIL", to exercise the rollback path.
type ledgerTransactionService struct {
	repo       *transactionRepo.TransactionRepository
	categoryID string
}

func (s *ledgerTransactionService) CreateTransaction(ctx context.Context, name, description string, amount money.Amount, typeTransaction string, accountId string, userId string, categoryId string, budgetId string, currency string, createdAt time.Time) error {
	_, err := s.CreateTransactionWithID(ctx, name, description, amount, typeTransaction, accountId, userId, categoryId, budgetId, currency, createdAt)
	return err
}

func (s *ledgerTransactionService) CreateTransactionWithID(ctx context.Context, name, description string, amount money.Amount, typeTransaction string, accountId string, userId string, _ string, _ string, currency string, createdAt time.Time) (string, error) {
	if strings.Contains(description, "FAIL") {
		return "", errors.New("ledger unavailable")
	}
	txn := transaction.NewTransaction(newID(), name, description, typeTransaction, accountId, s.categoryID, amount)
	txn.UserId = userId
	txn.Currency = currency
	txn.CreatedAt = createdAt
	return txn.Id, s.repo.Save(ctx, txn)
}

func (s *ledgerTransactionService) DeleteTransaction(context.Context, string, string) error {
	return errors.New("compensating deletes must not be used")
}

type cardFixture struct {
	userID     string
	accountID  string
	categoryID string
	cardID     string
	balanceID  string
}

func seedCard(t *testing.T, db *sql.DB, initialDebt money.Amount) cardFixture {
	t.Helper()
	ctx := context.Background()

	user := utils.GetNewRandomUser()
	require.NoError(t, userRepo.NewUserRepository(db).Save(ctx, user))

	accounts := accountRepo.NewAccountRepository(db)
	bank := account.NewAccount(money.FromInt(1_000_000), newID(), "Checking", "Bank")
	bank.UserId = user.Id
	require.NoError(t, accounts.Save(ctx, bank))

	cat := category.NewCategory(newID(), "Cards", "tag", "#123456")
	cat.UserId = user.Id
	require.NoError(t, categoryRepo.NewCategoryRepository(db).Save(ctx, cat))

	cardAccount := account.NewCreditCardAccount(newID(), "Visa", "Bank")
	cardAccount.UserId = user.Id
	require.NoError(t, accounts.Save(ctx, cardAccount))

	cards := creditcardRepo.NewCreditCardRepository(db)
	require.NoError(t, cards.SaveCard(ctx, creditcard.NewCreditCard(cardAccount.Id, "Bank", "4242", 10, 20)))
	balance := creditcard.NewCardBalance(newID(), cardAccount.Id, "DOP", money.FromInt(50_000))
	balance.CurrentBalance = initialDebt.Neg()
	require.NoError(t, cards.SaveBalance(ctx, balance))

	return cardFixture{userID: user.Id, accountID: bank.Id, categoryID: cat.Id, cardID: cardAccount.Id, balanceID: balance.Id}
}

// TestCreditCardPayment_ConcurrentPaymentsAreNotLost fires many payments at
// the same card balance at once, each in its own request transaction. With the
// old read-modify-write (read balance, add in Go, write it back) concurrent
// requests overwrote each other; the atomic `current_balance + $1` update must
// apply every single one.
func TestCreditCardPayment_ConcurrentPaymentsAreNotLost(t *testing.T) {
	db := SetUpTest()
	fx := seedCard(t, db, money.FromInt(1000))

	cards := creditcardRepo.NewCreditCardRepository(db)
	ledger := &ledgerTransactionService{repo: transactionRepo.NewTransactionRepository(db), categoryID: fx.categoryID}
	service := creditcardService.NewCreditCardService(cards, accountRepo.NewAccountRepository(db), ledger)

	const workers = 25
	payment := money.MustParse("12.34")

	var wg sync.WaitGroup
	errs := make(chan error, workers)
	start := make(chan struct{})
	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			<-start
			errs <- inRequestTx(context.Background(), db, func(ctx context.Context) error {
				_, err := service.CreatePayment(ctx, fx.cardID, fx.userID, &creditcardDto.CreatePaymentRequest{
					FromAccountId: fx.accountID,
					Currency:      "DOP",
					Amount:        payment,
					Notes:         fmt.Sprintf("payment %d", i),
				})
				return err
			})
		}(i)
	}
	close(start)
	wg.Wait()
	close(errs)
	for err := range errs {
		require.NoError(t, err)
	}

	balance, err := cards.FindBalanceById(context.Background(), fx.balanceID, fx.userID)
	require.NoError(t, err)
	// -1000 + 25 * 12.34 = -691.50, exactly.
	moneytest.Equal(t, "-691.50", balance.CurrentBalance)

	payments, err := cards.FindPaymentsByCard(context.Background(), fx.cardID, fx.userID)
	require.NoError(t, err)
	assert.Len(t, payments, workers)
}

// TestCreditCardPayment_FailureRollsBackEverything checks that a payment whose
// ledger write fails leaves no trace: the payment row, the balance change and
// any ledger row disappear with the request transaction, with no hand-written
// compensating writes.
func TestCreditCardPayment_FailureRollsBackEverything(t *testing.T) {
	db := SetUpTest()
	fx := seedCard(t, db, money.FromInt(500))

	cards := creditcardRepo.NewCreditCardRepository(db)
	ledger := &ledgerTransactionService{repo: transactionRepo.NewTransactionRepository(db), categoryID: fx.categoryID}
	service := creditcardService.NewCreditCardService(cards, accountRepo.NewAccountRepository(db), ledger)

	err := inRequestTx(context.Background(), db, func(ctx context.Context) error {
		_, err := service.CreatePayment(ctx, fx.cardID, fx.userID, &creditcardDto.CreatePaymentRequest{
			FromAccountId: fx.accountID,
			Currency:      "DOP",
			Amount:        money.FromInt(100),
			Notes:         "FAIL",
		})
		return err
	})
	require.Error(t, err)

	balance, err := cards.FindBalanceById(context.Background(), fx.balanceID, fx.userID)
	require.NoError(t, err)
	moneytest.Equal(t, -500, balance.CurrentBalance)

	payments, err := cards.FindPaymentsByCard(context.Background(), fx.cardID, fx.userID)
	require.NoError(t, err)
	assert.Empty(t, payments)
}

// TestCreditCardResetBalance_DoesNotLosePaymentsCommittedConcurrently resets
// the balance while payments are in flight: every payment is either included
// in the recorded previous balance or applied after the reset, never lost.
func TestCreditCardResetBalance_DoesNotLosePaymentsCommittedConcurrently(t *testing.T) {
	db := SetUpTest()
	fx := seedCard(t, db, money.FromInt(1000))
	cards := creditcardRepo.NewCreditCardRepository(db)

	const workers = 10
	var wg sync.WaitGroup
	var previous money.Amount
	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			assert.NoError(t, inRequestTx(context.Background(), db, func(ctx context.Context) error {
				_, err := cards.AdjustBalance(ctx, fx.balanceID, fx.userID, money.FromInt(10))
				return err
			}))
		}()
	}
	wg.Add(1)
	go func() {
		defer wg.Done()
		assert.NoError(t, inRequestTx(context.Background(), db, func(ctx context.Context) error {
			var err error
			previous, err = cards.ResetBalance(ctx, fx.balanceID, fx.userID)
			return err
		}))
	}()
	wg.Wait()

	balance, err := cards.FindBalanceById(context.Background(), fx.balanceID, fx.userID)
	require.NoError(t, err)
	// previous + current must account for the initial debt and every payment.
	moneytest.Equal(t, -900, previous.Add(balance.CurrentBalance))
}

// TestCreditCardResetBalance_ZeroesTheRealBalance resets a card whose charges
// are transactions on the card account. The real balance (what the API
// reports) is the stored balance plus those transactions; the reset must zero
// that, not just the stored part, or every past charge becomes debt again.
func TestCreditCardResetBalance_ZeroesTheRealBalance(t *testing.T) {
	db := SetUpTest()
	ctx := context.Background()
	fx := seedCard(t, db, money.FromInt(1000))

	cards := creditcardRepo.NewCreditCardRepository(db)
	ledger := &ledgerTransactionService{repo: transactionRepo.NewTransactionRepository(db), categoryID: fx.categoryID}
	service := creditcardService.NewCreditCardService(cards, accountRepo.NewAccountRepository(db), ledger)

	charge := func(amount int64) {
		t.Helper()
		_, err := ledger.CreateTransactionWithID(ctx, "Compra", "", money.FromInt(amount), "bill", fx.cardID, fx.userID, "", "", "DOP", time.Now())
		require.NoError(t, err)
	}
	realBalance := func() money.Amount {
		t.Helper()
		card, err := service.FindCardById(ctx, fx.cardID, fx.userID)
		require.NoError(t, err)
		require.Len(t, card.Balances, 1)
		return card.Balances[0].CurrentBalance
	}

	// Initial debt 1000, charges 500, payments 800: the card owes 700.
	charge(500)
	_, err := cards.AdjustBalance(ctx, fx.balanceID, fx.userID, money.FromInt(800))
	require.NoError(t, err)
	moneytest.Equal(t, -700, realBalance())

	var reset *creditcardDto.BalanceResetResponse
	require.NoError(t, inRequestTx(ctx, db, func(ctx context.Context) error {
		var err error
		reset, err = service.ResetCardBalance(ctx, fx.cardID, fx.userID, &creditcardDto.ResetBalanceRequest{BalanceId: fx.balanceID})
		return err
	}))
	moneytest.Equal(t, -700, reset.PreviousBalance)
	moneytest.Equal(t, 0, realBalance())

	// Charges after the reset are the only debt.
	charge(100)
	moneytest.Equal(t, -100, realBalance())
}

// TestLoanPayment_ConcurrentPaymentsAreSerialized pays a loan from many
// requests at once. The loan row is locked (SELECT ... FOR UPDATE) before its
// paid totals are recomputed, so no payment overwrites another.
func TestLoanPayment_ConcurrentPaymentsAreSerialized(t *testing.T) {
	db := SetUpTest()
	fx := seedCard(t, db, money.Zero)
	loans := loanRepo.NewLoanRepository(db)
	service := loanService.NewLoanService(loans, nil, accountRepo.NewAccountRepository(db), categoryRepo.NewCategoryRepository(db))

	created, err := service.CreateLoan(context.Background(), &loanDto.CreateLoanRequest{
		BorrowerName:    "Bob",
		PrincipalAmount: money.FromInt(1000),
		InterestMode:    string(loan.InterestModeNone),
		TermMonths:      3,
		SourceAccountId: fx.accountID,
	}, fx.userID)
	require.NoError(t, err)

	const workers = 10
	var wg sync.WaitGroup
	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			assert.NoError(t, inRequestTx(context.Background(), db, func(ctx context.Context) error {
				_, err := service.RegisterPayment(ctx, created.Id, fx.userID, &loanDto.RegisterLoanPaymentRequest{
					DestinationAccountId: fx.accountID,
					Amount:               money.FromInt(100),
				})
				return err
			}))
		}()
	}
	wg.Wait()

	stored, err := loans.FindById(context.Background(), created.Id, fx.userID)
	require.NoError(t, err)
	moneytest.Equal(t, 1000, stored.PaidPrincipal)
	assert.Equal(t, loan.LoanStatusPaid, stored.Status)

	installments, err := loans.FindInstallmentsByLoan(context.Background(), created.Id, fx.userID)
	require.NoError(t, err)
	sum := money.Zero
	for _, inst := range installments {
		sum = sum.Add(inst.ExpectedAmount)
	}
	// 1000 / 3 = 333.33 + 333.33 + 333.34: the schedule sums exactly.
	moneytest.Equal(t, 1000, sum)
}

// TestInvestmentFunding_ConcurrentPurchasesNeverOverdraw buys more than the
// wallet holds from concurrent requests. The conditional atomic decrement
// lets exactly the affordable purchases through and never goes negative.
func TestInvestmentFunding_ConcurrentPurchasesNeverOverdraw(t *testing.T) {
	db := SetUpTest()
	fx := seedCard(t, db, money.Zero)
	repo := investmentRepo.NewInvestmentRepository(db)
	ctx := context.Background()

	require.NoError(t, repo.AddFunding(ctx, &investment.FundingMovement{
		ID: newID(), UserID: fx.userID, Currency: "USD", Amount: money.FromInt(1000), MovementType: "deposit",
	}))

	const workers = 15
	var wg sync.WaitGroup
	var mu sync.Mutex
	succeeded, insufficient := 0, 0
	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			// 0.5 units at 200.00 = 100.00 per purchase.
			inv := investment.NewInvestment(newID(), fx.userID, investment.Crypto, "Bitcoin", "BTC", money.MustParse("0.5"), money.FromInt(200), money.FromInt(200))
			inv.SettlementCurrency = "USD"
			inv.SourceAmount = money.FromInt(100)
			err := inRequestTx(ctx, db, func(ctx context.Context) error {
				return repo.ConsumeFundingForInvestment(ctx, inv, "USD", money.FromInt(100))
			})
			mu.Lock()
			defer mu.Unlock()
			switch {
			case err == nil:
				succeeded++
			case errors.Is(err, investmentRepo.ErrInsufficientFunding):
				insufficient++
			default:
				t.Errorf("unexpected error: %v", err)
			}
		}()
	}
	wg.Wait()

	assert.Equal(t, 10, succeeded)
	assert.Equal(t, 5, insufficient)

	balances, err := repo.GetFundingBalances(ctx, fx.userID)
	require.NoError(t, err)
	require.Len(t, balances, 1)
	moneytest.Equal(t, 0, balances[0].Available)

	positions, err := repo.FindAll(ctx, fx.userID)
	require.NoError(t, err)
	require.Len(t, positions, 1, "purchases of the same symbol merge into one position")
	moneytest.Equal(t, 5, positions[0].Quantity)
	moneytest.Equal(t, 200, positions[0].PurchasePrice)
	moneytest.Equal(t, 1000, positions[0].SourceAmount)
}

// TestInvestmentPrecision_SubCentPricesAndLongQuantities checks migration
// 000050: crypto quantities and sub-cent prices round-trip exactly.
func TestInvestmentPrecision_SubCentPricesAndLongQuantities(t *testing.T) {
	db := SetUpTest()
	fx := seedCard(t, db, money.Zero)
	repo := investmentRepo.NewInvestmentRepository(db)
	ctx := context.Background()

	inv := investment.NewInvestment(newID(), fx.userID, investment.Crypto, "Shiba", "SHIB",
		money.MustParse("25000000000.123456789012345678"), money.MustParse("0.0000123456"), money.MustParse("0.0000234567"))
	inv.ExchangeRate = money.MustParse("0.0169491525")
	require.NoError(t, repo.Save(ctx, inv))

	stored, err := repo.FindByID(ctx, inv.ID, fx.userID)
	require.NoError(t, err)
	moneytest.Equal(t, "25000000000.123456789012345678", stored.Quantity)
	moneytest.Equal(t, "0.0000123456", stored.PurchasePrice)
	moneytest.Equal(t, "0.0000234567", stored.CurrentPrice)
	moneytest.Equal(t, "0.0169491525", stored.ExchangeRate)
}

// TestTransactionAmounts_StoredExactly round-trips amounts that float64
// cannot represent exactly.
func TestTransactionAmounts_StoredExactly(t *testing.T) {
	db := SetUpTest()
	fx := seedCard(t, db, money.Zero)
	repo := transactionRepo.NewTransactionRepository(db)
	accounts := accountRepo.NewAccountRepository(db)
	ctx := context.Background()

	for i := 0; i < 10; i++ {
		txn := transaction.NewTransaction(newID(), "tenth", "", "income", fx.accountID, fx.categoryID, money.MustParse("0.1"))
		txn.UserId = fx.userID
		txn.CreatedAt = time.Now()
		require.NoError(t, repo.Save(ctx, txn))
	}
	big := transaction.NewTransaction(newID(), "big", "", "income", fx.accountID, fx.categoryID, money.MustParse("1000000000.01"))
	big.UserId = fx.userID
	big.CreatedAt = time.Now()
	require.NoError(t, repo.Save(ctx, big))

	balance, err := accounts.Balance(ctx, fx.accountID, fx.userID)
	require.NoError(t, err)
	// 10 * 0.1 + 1e9 + 0.01 == 1000000001.01, exactly (float64 gives
	// 1000000001.0100001).
	moneytest.Equal(t, "1000000001.01", balance)
}
