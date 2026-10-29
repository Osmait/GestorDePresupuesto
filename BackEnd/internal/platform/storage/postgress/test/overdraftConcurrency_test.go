package postgress

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/osmait/gestorDePresupuesto/internal/domain/account"
	"github.com/osmait/gestorDePresupuesto/internal/domain/loan"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money/moneytest"
	creditcardDto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/creditcard"
	loanDto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/loan"
	accountRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/account"
	categoryRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/category"
	creditcardRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/creditcard"
	loanRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/loan"
	transactionRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/transaction"
	creditcardService "github.com/osmait/gestorDePresupuesto/internal/services/creditcard"
	"github.com/osmait/gestorDePresupuesto/internal/services/funds"
	loanService "github.com/osmait/gestorDePresupuesto/internal/services/loan"
)

// seedLowBalanceCard is seedCard with a paying account that holds only
// `available` (initial balance), so overdrafts can be provoked.
func seedLowBalanceCard(t *testing.T, db *sql.DB, available money.Amount) cardFixture {
	t.Helper()
	fx := seedCard(t, db, money.FromInt(1000))
	accounts := accountRepo.NewAccountRepository(db)
	low := account.NewAccount(available, newID(), "Savings", "Bank")
	low.UserId = fx.userID
	require.NoError(t, accounts.Save(context.Background(), low))
	fx.accountID = low.Id
	return fx
}

// runConcurrently starts every fn at the same time, each in its own request
// transaction, and returns their errors.
func runConcurrently(db *sql.DB, fns ...func(ctx context.Context) error) []error {
	var wg sync.WaitGroup
	start := make(chan struct{})
	errs := make([]error, len(fns))
	for i, fn := range fns {
		wg.Add(1)
		go func(i int, fn func(ctx context.Context) error) {
			defer wg.Done()
			<-start
			errs[i] = inRequestTx(context.Background(), db, fn)
		}(i, fn)
	}
	close(start)
	wg.Wait()
	return errs
}

func countOutcomes(t *testing.T, errs []error) (succeeded, insufficient int) {
	t.Helper()
	for _, err := range errs {
		switch {
		case err == nil:
			succeeded++
		case errors.Is(err, funds.ErrInsufficientFunds):
			insufficient++
		default:
			t.Errorf("unexpected error: %v", err)
		}
	}
	return succeeded, insufficient
}

// TestCreditCardPayment_ConcurrentOverdraftExactlyOneSucceeds sends two
// payments that each fit in the paying account but not together. The account
// row lock (SELECT ... FOR UPDATE) serialises them: exactly one passes the
// funds check and the account never goes negative.
func TestCreditCardPayment_ConcurrentOverdraftExactlyOneSucceeds(t *testing.T) {
	db := SetUpTest()
	fx := seedLowBalanceCard(t, db, money.FromInt(100))

	cards := creditcardRepo.NewCreditCardRepository(db)
	accounts := accountRepo.NewAccountRepository(db)
	ledger := &ledgerTransactionService{repo: transactionRepo.NewTransactionRepository(db), categoryID: fx.categoryID}
	service := creditcardService.NewCreditCardService(cards, accounts, ledger)

	pay := func(i int) func(ctx context.Context) error {
		return func(ctx context.Context) error {
			_, err := service.CreatePayment(ctx, fx.cardID, fx.userID, &creditcardDto.CreatePaymentRequest{
				FromAccountId: fx.accountID,
				Currency:      "DOP",
				Amount:        money.FromInt(60),
				Notes:         fmt.Sprintf("payment %d", i),
			})
			return err
		}
	}

	succeeded, insufficient := countOutcomes(t, runConcurrently(db, pay(1), pay(2)))
	assert.Equal(t, 1, succeeded)
	assert.Equal(t, 1, insufficient)

	ctx := context.Background()
	movements, err := accounts.Balance(ctx, fx.accountID, fx.userID)
	require.NoError(t, err)
	moneytest.Equal(t, 40, money.FromInt(100).Add(movements))

	payments, err := cards.FindPaymentsByCard(ctx, fx.cardID, fx.userID)
	require.NoError(t, err)
	assert.Len(t, payments, 1, "the rejected payment leaves no row")

	moneytest.Equal(t, -940, cardDebtBalance(t, db, fx))
}

// TestLoanDisbursement_ConcurrentOverdraftExactlyOneSucceeds does the same for
// loan disbursements from one source account.
func TestLoanDisbursement_ConcurrentOverdraftExactlyOneSucceeds(t *testing.T) {
	db := SetUpTest()
	fx := seedLowBalanceCard(t, db, money.FromInt(100))

	accounts := accountRepo.NewAccountRepository(db)
	ledger := &ledgerTransactionService{repo: transactionRepo.NewTransactionRepository(db), categoryID: fx.categoryID}
	service := loanService.NewLoanService(loanRepo.NewLoanRepository(db), ledger, accounts, categoryRepo.NewCategoryRepository(db))

	lend := func(ctx context.Context) error {
		_, err := service.CreateLoan(ctx, &loanDto.CreateLoanRequest{
			BorrowerName:    "Bob",
			PrincipalAmount: money.FromInt(70),
			InterestMode:    string(loan.InterestModeNone),
			TermMonths:      1,
			SourceAccountId: fx.accountID,
		}, fx.userID)
		return err
	}

	succeeded, insufficient := countOutcomes(t, runConcurrently(db, lend, lend))
	assert.Equal(t, 1, succeeded)
	assert.Equal(t, 1, insufficient)

	movements, err := accounts.Balance(context.Background(), fx.accountID, fx.userID)
	require.NoError(t, err)
	moneytest.Equal(t, 30, money.FromInt(100).Add(movements))
}
