package postgress

import (
	"context"
	"database/sql"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/osmait/gestorDePresupuesto/internal/domain/account"
	categoryDomain "github.com/osmait/gestorDePresupuesto/internal/domain/category"
	"github.com/osmait/gestorDePresupuesto/internal/domain/creditcard"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
	"github.com/osmait/gestorDePresupuesto/internal/platform/cache"
	accountRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/account"
	analyticsRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/analytics"
	budgetRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/budget"
	categoryRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/category"
	creditcardRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/creditcard"
	notificationRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/notification"
	transactionRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/transaction"
	userRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/user"
	"github.com/osmait/gestorDePresupuesto/internal/platform/utils"
	accountService "github.com/osmait/gestorDePresupuesto/internal/services/account"
	"github.com/osmait/gestorDePresupuesto/internal/services/errorhttp"
	notificationService "github.com/osmait/gestorDePresupuesto/internal/services/notification"
	transactionService "github.com/osmait/gestorDePresupuesto/internal/services/transaction"
)

type reconcileFixture struct {
	db         *sql.DB
	service    *accountService.AccountService
	txRepo     *transactionRepo.TransactionRepository
	userId     string
	bankId     string
	categoryId string
}

func newReconcileFixture(t *testing.T, initial money.Amount) *reconcileFixture {
	t.Helper()
	ctx := context.Background()
	db := SetUpTest()

	user := utils.GetNewRandomUser()
	require.NoError(t, userRepo.NewUserRepository(db).Save(ctx, user))
	accounts := accountRepo.NewAccountRepository(db)
	bank := account.NewAccount(initial, newID(), "Principal", "Ban Reservas")
	bank.UserId = user.Id
	require.NoError(t, accounts.Save(ctx, bank))

	cat := categoryDomain.NewCategory(newID(), "Comida", "🍔", "#ff0000")
	cat.UserId = user.Id
	categories := categoryRepo.NewCategoryRepository(db)
	require.NoError(t, categories.Save(ctx, cat))

	txRepo := transactionRepo.NewTransactionRepository(db)
	notifications := notificationService.NewNotificationService(notificationRepo.NewNotificationRepository(db))
	txService := transactionService.NewTransactionService(txRepo, budgetRepo.NewBudgetRepository(db), notifications,
		cache.NewInMemoryCache(time.Minute, time.Minute), nil, nil)

	service := accountService.NewAccountService(accounts,
		accountService.WithReconciliation(accountRepo.NewReconciliationRepository(db), txService, categories))
	return &reconcileFixture{db: db, service: service, txRepo: txRepo, userId: user.Id, bankId: bank.Id, categoryId: cat.Id}
}

func (f *reconcileFixture) balance(t *testing.T) money.Amount {
	t.Helper()
	acc, err := f.service.FindById(context.Background(), f.bankId, f.userId)
	require.NoError(t, err)
	return acc.CurrentBalance
}

func (f *reconcileFixture) addBill(t *testing.T, amount string) {
	t.Helper()
	txn := utils.GetNewRandomTransaction()
	txn.Id = newID()
	txn.TypeTransation = "bill"
	txn.Amount = money.MustParse(amount)
	txn.AccountId = f.bankId
	txn.CategoryId = f.categoryId
	txn.UserId = f.userId
	txn.Currency = "DOP"
	txn.CreatedAt = time.Now()
	require.NoError(t, f.txRepo.Save(context.Background(), txn))
}

func TestAccountReconcile(t *testing.T) {
	ctx := context.Background()

	t.Run("bank shows more: adjustment_in brings the account to the bank balance", func(t *testing.T) {
		f := newReconcileFixture(t, money.MustParse("1000"))
		f.addBill(t, "250.50")
		require.True(t, f.balance(t).Equal(money.MustParse("749.50")))

		result, err := f.service.Reconcile(ctx, f.bankId, f.userId, accountService.ReconcileInput{BankBalance: money.MustParse("800"), Notes: "app del banco"})
		require.NoError(t, err)
		assert.True(t, result.Adjusted)
		assert.True(t, result.Difference.Equal(money.MustParse("50.50")), "difference %s", result.Difference)
		assert.True(t, f.balance(t).Equal(money.MustParse("800")))

		var txType, categoryId, description string
		var amount money.Amount
		require.NoError(t, f.db.QueryRow(`SELECT type_transation, amount, category_id, transaction_description FROM transactions WHERE id = $1`,
			result.Reconciliation.TransactionId).Scan(&txType, &amount, &categoryId, &description))
		assert.Equal(t, account.AdjustmentIn, txType)
		assert.True(t, amount.Equal(money.MustParse("50.50")))
		assert.Equal(t, categoryDomain.SystemBalanceAdjustment.ID(f.userId), categoryId)
		assert.Equal(t, "app del banco", description)

		history, err := f.service.Reconciliations(ctx, f.bankId, f.userId)
		require.NoError(t, err)
		require.Len(t, history, 1)
		assert.True(t, history[0].AppBalance.Equal(money.MustParse("749.50")))
		assert.True(t, history[0].BankBalance.Equal(money.MustParse("800")))
		assert.Equal(t, "DOP", history[0].Currency)

		list, err := f.service.FindAll(ctx, f.userId)
		require.NoError(t, err)
		require.Len(t, list, 1)
		require.NotNil(t, list[0].LastReconciledAt)
		assert.WithinDuration(t, time.Now(), *list[0].LastReconciledAt, time.Minute)
	})

	t.Run("bank shows less: adjustment_out, including sub-cent app balances", func(t *testing.T) {
		f := newReconcileFixture(t, money.MustParse("48162.5775"))

		result, err := f.service.Reconcile(ctx, f.bankId, f.userId, accountService.ReconcileInput{BankBalance: money.MustParse("40000")})
		require.NoError(t, err)
		assert.True(t, result.Adjusted)
		assert.True(t, result.Difference.Equal(money.MustParse("-8162.5775")), "difference %s", result.Difference)
		assert.True(t, f.balance(t).Equal(money.MustParse("40000")), "balance %s", f.balance(t))

		var txType string
		require.NoError(t, f.db.QueryRow(`SELECT type_transation FROM transactions WHERE id = $1`, result.Reconciliation.TransactionId).Scan(&txType))
		assert.Equal(t, account.AdjustmentOut, txType)
	})

	t.Run("matching balance records the check without a transaction", func(t *testing.T) {
		f := newReconcileFixture(t, money.MustParse("500"))

		result, err := f.service.Reconcile(ctx, f.bankId, f.userId, accountService.ReconcileInput{BankBalance: money.MustParse("500.00")})
		require.NoError(t, err)
		assert.False(t, result.Adjusted)
		assert.Empty(t, result.Reconciliation.TransactionId)

		var count int
		require.NoError(t, f.db.QueryRow(`SELECT COUNT(*) FROM transactions WHERE account_id = $1`, f.bankId).Scan(&count))
		assert.Zero(t, count)
		history, err := f.service.Reconciliations(ctx, f.bankId, f.userId)
		require.NoError(t, err)
		assert.Len(t, history, 1)
	})

	t.Run("an overdrawn bank balance is accepted", func(t *testing.T) {
		f := newReconcileFixture(t, money.MustParse("100"))

		_, err := f.service.Reconcile(ctx, f.bankId, f.userId, accountService.ReconcileInput{BankBalance: money.MustParse("-550")})
		require.NoError(t, err)
		assert.True(t, f.balance(t).Equal(money.MustParse("-550")))
	})

	t.Run("adjustments are neutral in income/expense totals", func(t *testing.T) {
		f := newReconcileFixture(t, money.MustParse("1000"))
		f.addBill(t, "100")
		analytics := analyticsRepo.NewAnalyticsRepository(f.db)
		before, err := analytics.GetTotals(ctx, f.userId, money.FromInt(60))
		require.NoError(t, err)

		_, err = f.service.Reconcile(ctx, f.bankId, f.userId, accountService.ReconcileInput{BankBalance: money.MustParse("2000")})
		require.NoError(t, err)
		_, err = f.service.Reconcile(ctx, f.bankId, f.userId, accountService.ReconcileInput{BankBalance: money.MustParse("10")})
		require.NoError(t, err)

		after, err := analytics.GetTotals(ctx, f.userId, money.FromInt(60))
		require.NoError(t, err)
		assert.True(t, before.TotalIncome.Equal(after.TotalIncome), "income %s -> %s", before.TotalIncome, after.TotalIncome)
		assert.True(t, before.TotalBill.Equal(after.TotalBill), "bill %s -> %s", before.TotalBill, after.TotalBill)
	})

	t.Run("deleting the adjustment keeps the history row", func(t *testing.T) {
		f := newReconcileFixture(t, money.MustParse("1000"))
		result, err := f.service.Reconcile(ctx, f.bankId, f.userId, accountService.ReconcileInput{BankBalance: money.MustParse("900")})
		require.NoError(t, err)

		require.NoError(t, f.txRepo.Delete(ctx, result.Reconciliation.TransactionId, f.userId))
		assert.True(t, f.balance(t).Equal(money.MustParse("1000")))

		history, err := f.service.Reconciliations(ctx, f.bankId, f.userId)
		require.NoError(t, err)
		require.Len(t, history, 1)
		assert.Empty(t, history[0].TransactionId)
	})

	t.Run("a credit card is reconciled to the debt of its statement", func(t *testing.T) {
		f := newReconcileFixture(t, money.Zero)
		card := account.NewCreditCardAccount(newID(), "Visa", "Bank")
		card.UserId = f.userId
		require.NoError(t, accountRepo.NewAccountRepository(f.db).Save(ctx, card))
		cards := creditcardRepo.NewCreditCardRepository(f.db)
		require.NoError(t, cards.SaveCard(ctx, creditcard.NewCreditCard(card.Id, "Bank", "4242", 10, 20)))
		require.NoError(t, cards.SaveBalance(ctx, creditcard.NewCardBalance(newID(), card.Id, "DOP", money.FromInt(10_000))))

		charge := utils.GetNewRandomTransaction()
		charge.Id, charge.TypeTransation, charge.Amount = newID(), "bill", money.FromInt(300)
		charge.AccountId, charge.CategoryId, charge.UserId, charge.Currency, charge.CreatedAt = card.Id, f.categoryId, f.userId, "DOP", time.Now()
		require.NoError(t, f.txRepo.Save(ctx, charge))

		// The statement says the card owes 1,250.
		result, err := f.service.Reconcile(ctx, card.Id, f.userId, accountService.ReconcileInput{BankBalance: money.FromInt(-1250)})
		require.NoError(t, err)
		assert.True(t, result.Difference.Equal(money.FromInt(-950)), "difference %s", result.Difference)

		acc, err := f.service.FindById(ctx, card.Id, f.userId)
		require.NoError(t, err)
		assert.True(t, acc.CurrentBalance.Equal(money.FromInt(-1250)), "card balance %s", acc.CurrentBalance)

		// A currency the card does not have cannot be adjusted.
		_, err = f.service.Reconcile(ctx, card.Id, f.userId, accountService.ReconcileInput{BankBalance: money.FromInt(-10), Currency: "USD"})
		assert.Error(t, err)
	})

	t.Run("another user's account is not found", func(t *testing.T) {
		f := newReconcileFixture(t, money.FromInt(10))
		other := newReconcileFixture(t, money.FromInt(10))

		_, err := f.service.Reconcile(ctx, other.bankId, f.userId, accountService.ReconcileInput{BankBalance: money.FromInt(5)})
		assert.ErrorIs(t, err, errorhttp.ErrNotFound)
		_, err = f.service.Reconciliations(ctx, other.bankId, f.userId)
		assert.ErrorIs(t, err, errorhttp.ErrNotFound)
		assert.True(t, other.balance(t).Equal(money.FromInt(10)))
	})
}
