package postgress

import (
	"context"
	"database/sql"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/osmait/gestorDePresupuesto/internal/domain/account"
	"github.com/osmait/gestorDePresupuesto/internal/domain/creditcard"
	"github.com/osmait/gestorDePresupuesto/internal/domain/loan"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
	"github.com/osmait/gestorDePresupuesto/internal/domain/transaction"
	loanDto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/loan"
	accountRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/account"
	categoryRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/category"
	certificateRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/certificate"
	creditcardRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/creditcard"
	loanRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/loan"
	transactionRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/transaction"
	"github.com/osmait/gestorDePresupuesto/internal/platform/utils"
	loanService "github.com/osmait/gestorDePresupuesto/internal/services/loan"
)

// The batched lookups below replace one query per item in list endpoints;
// each test seeds several items and checks the batch returns exactly what the
// per-item query returns for every one of them.

// addCards adds n credit cards (account and card row, no balances) to userID.
func addCards(t *testing.T, db *sql.DB, userID string, n int) []string {
	t.Helper()
	ctx := context.Background()
	accounts := accountRepo.NewAccountRepository(db)
	cards := creditcardRepo.NewCreditCardRepository(db)
	ids := make([]string, 0, n)
	for i := 0; i < n; i++ {
		acc := account.NewCreditCardAccount(newID(), "Card", "Bank")
		acc.UserId = userID
		require.NoError(t, accounts.Save(ctx, acc))
		require.NoError(t, cards.SaveCard(ctx, creditcard.NewCreditCard(acc.Id, "Bank", "1234", 5, 25)))
		ids = append(ids, acc.Id)
	}
	return ids
}

func addTransaction(t *testing.T, db *sql.DB, fx cardFixture, accountID, kind, currency string, amount int64) {
	t.Helper()
	txn := transaction.NewTransaction(newID(), "seed", "", kind, accountID, fx.categoryID, money.FromInt(amount))
	txn.UserId = fx.userID
	txn.Currency = currency
	txn.CreatedAt = time.Now()
	require.NoError(t, transactionRepo.NewTransactionRepository(db).Save(context.Background(), txn))
}

func TestBatchedLookups_BalancesByCurrency(t *testing.T) {
	db := SetUpTest()
	ctx := context.Background()
	accounts := accountRepo.NewAccountRepository(db)

	fx := seedCard(t, db, money.FromInt(700))
	more := addCards(t, db, fx.userID, 2)
	ids := []string{fx.cardID, more[0], more[1], fx.accountID}
	addTransaction(t, db, fx, fx.cardID, "bill", "USD", 20)
	addTransaction(t, db, fx, more[0], "bill", "DOP", 100)
	addTransaction(t, db, fx, more[0], "income", "DOP", 30)
	addTransaction(t, db, fx, more[0], "bill", "EUR", 7)
	addTransaction(t, db, fx, fx.accountID, "bill", "DOP", 5)
	// more[1] has no transactions.

	// Another user's card is never counted, even when its id is asked for.
	other := seedCard(t, db, money.FromInt(900))
	ids = append(ids, other.cardID)

	got, err := accounts.BalancesByCurrency(ctx, ids, fx.userID)
	require.NoError(t, err)
	assert.NotContains(t, got, other.cardID)
	assert.NotContains(t, got, more[1])

	for _, id := range ids {
		for _, currency := range []string{"DOP", "USD", "EUR", "GBP"} {
			want, err := accounts.BalanceByCurrency(ctx, id, fx.userID, currency)
			require.NoError(t, err)
			assert.True(t, want.Equal(got[id][currency]), "account %s %s: per-item %s, batch %s", id, currency, want, got[id][currency])
		}
	}
	assert.Equal(t, "-700", got[fx.cardID]["DOP"].String())
	assert.Equal(t, "-70", got[more[0]]["DOP"].String())

	empty, err := accounts.BalancesByCurrency(ctx, nil, fx.userID)
	require.NoError(t, err)
	assert.Empty(t, empty)
}

func TestBatchedLookups_FindBalancesByCards(t *testing.T) {
	db := SetUpTest()
	ctx := context.Background()
	cards := creditcardRepo.NewCreditCardRepository(db)

	fx := seedCard(t, db, money.Zero) // one DOP balance
	more := addCards(t, db, fx.userID, 2)
	for _, currency := range []string{"USD", "EUR", "DOP"} {
		require.NoError(t, cards.SaveBalance(ctx, creditcard.NewCardBalance(newID(), more[0], currency, money.FromInt(1000))))
	}
	require.NoError(t, cards.SaveBalance(ctx, creditcard.NewCardBalance(newID(), fx.cardID, "USD", money.FromInt(300))))
	// more[1] has no balances.
	other := seedCard(t, db, money.Zero)
	ids := []string{fx.cardID, more[0], more[1], other.cardID}

	got, err := cards.FindBalancesByCards(ctx, ids, fx.userID)
	require.NoError(t, err)
	assert.NotContains(t, got, other.cardID)
	assert.NotContains(t, got, more[1])

	for _, id := range ids {
		want, err := cards.FindBalancesByCard(ctx, id, fx.userID)
		require.NoError(t, err)
		assert.Equal(t, want, got[id], "card %s", id)
	}
	require.Len(t, got[more[0]], 3)
	assert.Equal(t, []string{"DOP", "EUR", "USD"},
		[]string{got[more[0]][0].Currency, got[more[0]][1].Currency, got[more[0]][2].Currency})

	empty, err := cards.FindBalancesByCards(ctx, nil, fx.userID)
	require.NoError(t, err)
	assert.Empty(t, empty)
}

func TestBatchedLookups_FindInstallmentsByLoans(t *testing.T) {
	db := SetUpTest()
	ctx := context.Background()
	fx := seedCard(t, db, money.Zero)
	loans := loanRepo.NewLoanRepository(db)
	service := loanService.NewLoanService(loans, nil, accountRepo.NewAccountRepository(db), categoryRepo.NewCategoryRepository(db))

	var ids []string
	for _, term := range []int{3, 1, 6} {
		created, err := service.CreateLoan(ctx, &loanDto.CreateLoanRequest{
			BorrowerName:    "Borrower",
			PrincipalAmount: money.FromInt(1200),
			InterestMode:    string(loan.InterestModeNone),
			TermMonths:      term,
			SourceAccountId: fx.accountID,
		}, fx.userID)
		require.NoError(t, err)
		ids = append(ids, created.Id)
	}
	other := seedCard(t, db, money.Zero)
	otherLoan, err := service.CreateLoan(ctx, &loanDto.CreateLoanRequest{
		BorrowerName: "Other", PrincipalAmount: money.FromInt(100), InterestMode: string(loan.InterestModeNone),
		TermMonths: 2, SourceAccountId: other.accountID,
	}, other.userID)
	require.NoError(t, err)
	ids = append(ids, otherLoan.Id, "missing-loan")

	got, err := loans.FindInstallmentsByLoans(ctx, ids, fx.userID)
	require.NoError(t, err)
	assert.Len(t, got, 3)

	for _, id := range ids {
		want, err := loans.FindInstallmentsByLoan(ctx, id, fx.userID)
		require.NoError(t, err)
		assert.Equal(t, want, got[id], "loan %s", id)
	}
	assert.Len(t, got[ids[0]], 3)
	assert.Len(t, got[ids[1]], 1)
	assert.Len(t, got[ids[2]], 6)

	empty, err := loans.FindInstallmentsByLoans(ctx, nil, fx.userID)
	require.NoError(t, err)
	assert.Empty(t, empty)
}

func TestBatchedLookups_FindLastPayments(t *testing.T) {
	db := SetUpTest()
	ctx := context.Background()
	certs := certificateRepo.NewCertificateRepository(db)
	fx := seedCard(t, db, money.Zero)
	other := seedCard(t, db, money.Zero)

	newCert := func(userID string) string {
		cert := utils.GetNewRandomCertificate(userID)
		cert.Id = newID()
		require.NoError(t, certs.Save(ctx, cert))
		return cert.Id
	}
	addPayment := func(certID, userID string, paidOn time.Time) {
		p := utils.GetNewRandomCertificatePayment(certID, userID)
		p.Id = newID()
		p.PaymentDate = paidOn
		require.NoError(t, certs.SavePayment(ctx, p))
	}

	base := time.Date(2026, time.March, 15, 12, 0, 0, 0, time.UTC)
	three, one, none := newCert(fx.userID), newCert(fx.userID), newCert(fx.userID)
	// Saved out of date order: the newest is the middle insert.
	addPayment(three, fx.userID, base.AddDate(0, -2, 0))
	addPayment(three, fx.userID, base)
	addPayment(three, fx.userID, base.AddDate(0, -1, 0))
	addPayment(one, fx.userID, base.AddDate(0, -5, 0))
	foreign := newCert(other.userID)
	addPayment(foreign, other.userID, base)
	ids := []string{three, one, none, foreign}

	got, err := certs.FindLastPayments(ctx, ids, fx.userID)
	require.NoError(t, err)
	assert.Len(t, got, 2)

	for _, id := range ids {
		want, err := certs.FindLastPayment(ctx, id, fx.userID)
		if errors.Is(err, sql.ErrNoRows) {
			assert.NotContains(t, got, id, "certificate %s has no payment", id)
			continue
		}
		require.NoError(t, err)
		assert.Equal(t, want, got[id], "certificate %s", id)
	}
	assert.True(t, got[three].PaymentDate.Equal(base))

	empty, err := certs.FindLastPayments(ctx, nil, fx.userID)
	require.NoError(t, err)
	assert.Empty(t, empty)
}
