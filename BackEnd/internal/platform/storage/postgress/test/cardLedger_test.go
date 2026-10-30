package postgress

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/osmait/gestorDePresupuesto/internal/domain/account"
	"github.com/osmait/gestorDePresupuesto/internal/domain/category"
	"github.com/osmait/gestorDePresupuesto/internal/domain/creditcard"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money/moneytest"
	"github.com/osmait/gestorDePresupuesto/internal/platform/cache"
	creditcardDto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/creditcard"
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
	analyticsService "github.com/osmait/gestorDePresupuesto/internal/services/analytics"
	creditcardService "github.com/osmait/gestorDePresupuesto/internal/services/creditcard"
	notificationService "github.com/osmait/gestorDePresupuesto/internal/services/notification"
	transactionService "github.com/osmait/gestorDePresupuesto/internal/services/transaction"
)

// A credit card's debt is the ledger balance of its account (migration
// 000060): every screen (credit card endpoints, GET /account, dashboard) must
// report the same number, and payments must be transfers, not expenses.

type cardLedgerFixture struct {
	userId    string
	bankId    string
	foodCat   string
	cards     *creditcardService.CreditCardService
	accounts  *accountService.AccountService
	analytics *analyticsService.AnalyticsService
	txRepo    *transactionRepo.TransactionRepository
}

func newCardLedgerFixture(t *testing.T) *cardLedgerFixture {
	t.Helper()
	ctx := context.Background()
	db := SetUpTest()

	user := utils.GetNewRandomUser()
	require.NoError(t, userRepo.NewUserRepository(db).Save(ctx, user))
	accRepo := accountRepo.NewAccountRepository(db)
	bank := account.NewAccount(money.FromInt(100_000), newID(), "Principal", "Ban Reservas")
	bank.UserId = user.Id
	require.NoError(t, accRepo.Save(ctx, bank))
	food := category.NewCategory(newID(), "Comida", "🍔", "#f00")
	food.UserId = user.Id
	categories := categoryRepo.NewCategoryRepository(db)
	require.NoError(t, categories.Save(ctx, food))

	txRepo := transactionRepo.NewTransactionRepository(db)
	txService := transactionService.NewTransactionService(txRepo, budgetRepo.NewBudgetRepository(db),
		notificationService.NewNotificationService(notificationRepo.NewNotificationRepository(db)),
		cache.NewInMemoryCache(time.Minute, time.Minute), nil, nil)
	rate := func(context.Context) (money.Amount, error) { return money.FromInt(60), nil }

	return &cardLedgerFixture{
		userId:  user.Id,
		bankId:  bank.Id,
		foodCat: food.Id,
		cards:   creditcardService.NewCreditCardService(creditcardRepo.NewCreditCardRepository(db), accRepo, txService),
		accounts: accountService.NewAccountService(accRepo,
			accountService.WithReconciliation(accountRepo.NewReconciliationRepository(db), txService, categories)),
		analytics: analyticsService.NewAnalyticsService(analyticsRepo.NewAnalyticsRepository(db), accRepo, nil, nil, rate),
		txRepo:    txRepo,
	}
}

// aroundNow is a dashboard range that contains time.Now() whatever the time
// of day (the default range ends today in Santo Domingo, which at night is
// already yesterday in UTC).
func aroundNow() analyticsService.DashboardFilters {
	now := time.Now().UTC()
	return analyticsService.DashboardFilters{DateFrom: now.AddDate(0, 0, -1), DateTo: now.AddDate(0, 0, 1)}
}

func (f *cardLedgerFixture) charge(t *testing.T, cardId, currency string, amount int64) {
	t.Helper()
	txn := utils.GetNewRandomTransaction()
	txn.Id, txn.TypeTransation, txn.Amount = newID(), "bill", money.FromInt(amount)
	txn.AccountId, txn.CategoryId, txn.UserId, txn.Currency, txn.CreatedAt = cardId, f.foodCat, f.userId, currency, time.Now()
	require.NoError(t, f.txRepo.Save(context.Background(), txn))
}

func (f *cardLedgerFixture) cardBalances(t *testing.T, cardId string) map[string]money.Amount {
	t.Helper()
	card, err := f.cards.FindCardById(context.Background(), cardId, f.userId)
	require.NoError(t, err)
	out := map[string]money.Amount{}
	for _, b := range card.Balances {
		out[b.Currency] = b.CurrentBalance
	}
	return out
}

func TestCardLedger(t *testing.T) {
	ctx := context.Background()

	t.Run("initial debt is the first ledger entry and every screen agrees", func(t *testing.T) {
		f := newCardLedgerFixture(t)
		card, err := f.cards.CreateCreditCard(ctx, &creditcardDto.CreateCreditCardRequest{
			Name: "Tarjeta Principal", Bank: "Ban Reservas", CutDay: 8, DueDay: 2,
			Balances: []creditcardDto.CreateBalanceRequest{
				{Currency: "DOP", CreditLimit: money.FromInt(22_000), InitialDebt: money.FromInt(5_000)},
				{Currency: "USD", CreditLimit: money.FromInt(300), InitialDebt: money.FromInt(40)},
			},
		}, f.userId)
		require.NoError(t, err)
		f.charge(t, card.Id, "DOP", 1_200)
		f.charge(t, card.Id, "USD", 10)

		balances := f.cardBalances(t, card.Id)
		moneytest.Equal(t, -6_200, balances["DOP"])
		moneytest.Equal(t, -50, balances["USD"])

		// GET /account shows the card in its primary currency, not DOP + USD.
		acc, err := f.accounts.FindById(ctx, card.Id, f.userId)
		require.NoError(t, err)
		moneytest.Equal(t, -6_200, acc.CurrentBalance)
		list, err := f.accounts.FindAll(ctx, f.userId)
		require.NoError(t, err)
		for _, a := range list {
			if a.AccountInfo.Id == card.Id {
				moneytest.Equal(t, -6_200, a.CurrentBalance)
			}
		}

		// The dashboard owes 6,200 DOP + 50 USD * 60 and keeps bank accounts apart.
		summary, err := f.analytics.GetDashboardSummary(ctx, f.userId, aroundNow())
		require.NoError(t, err)
		moneytest.Equal(t, 9_200, summary.CreditCardDebt)
		assert.Equal(t, 1, summary.CreditCardsCount)
		moneytest.Equal(t, 100_000, summary.AccountsTotal)
		// Neither the initial debt nor the charges' adjustment counts as expense
		// beyond the charges themselves (1,200 DOP + 10 USD * 60).
		moneytest.Equal(t, 1_800, summary.TotalExpenses)
	})

	t.Run("a payment is a transfer: debt down, bank down, no expense", func(t *testing.T) {
		f := newCardLedgerFixture(t)
		card, err := f.cards.CreateCreditCard(ctx, &creditcardDto.CreateCreditCardRequest{
			Name: "Qik", Bank: "Banco Qik", CutDay: 5, DueDay: 3,
			Balances: []creditcardDto.CreateBalanceRequest{{Currency: "DOP", CreditLimit: money.FromInt(35_000)}},
		}, f.userId)
		require.NoError(t, err)
		f.charge(t, card.Id, "DOP", 3_000)
		before, err := f.analytics.GetDashboardSummary(ctx, f.userId, aroundNow())
		require.NoError(t, err)

		_, err = f.cards.CreatePayment(ctx, card.Id, f.userId, &creditcardDto.CreatePaymentRequest{
			FromAccountId: f.bankId, Currency: "DOP", Amount: money.FromInt(2_500),
		})
		require.NoError(t, err)

		moneytest.Equal(t, -500, f.cardBalances(t, card.Id)["DOP"])
		bank, err := f.accounts.FindById(ctx, f.bankId, f.userId)
		require.NoError(t, err)
		moneytest.Equal(t, 97_500, bank.CurrentBalance)

		var received int
		require.NoError(t, SetUpTest().QueryRow(`SELECT COUNT(*) FROM transactions WHERE account_id = $1 AND type_transation = $2`,
			card.Id, creditcard.PaymentReceivedType).Scan(&received))
		assert.Equal(t, 1, received)

		after, err := f.analytics.GetDashboardSummary(ctx, f.userId, aroundNow())
		require.NoError(t, err)
		moneytest.Equal(t, before.TotalExpenses, after.TotalExpenses)
		moneytest.Equal(t, before.TotalIncome, after.TotalIncome)
		moneytest.Equal(t, 500, after.CreditCardDebt)
	})

	t.Run("reset writes one adjustment to zero and records the previous debt", func(t *testing.T) {
		f := newCardLedgerFixture(t)
		card, err := f.cards.CreateCreditCard(ctx, &creditcardDto.CreateCreditCardRequest{
			Name: "Gastos personales", Bank: "Ban Reservas", CutDay: 2, DueDay: 24,
			Balances: []creditcardDto.CreateBalanceRequest{{Currency: "DOP", CreditLimit: money.FromInt(10_000), InitialDebt: money.FromInt(1_000)}},
		}, f.userId)
		require.NoError(t, err)
		f.charge(t, card.Id, "DOP", 250)

		reset, err := f.cards.ResetCardBalance(ctx, card.Id, f.userId, &creditcardDto.ResetBalanceRequest{Currency: "DOP", Notes: "estado de octubre"})
		require.NoError(t, err)
		moneytest.Equal(t, -1_250, reset.PreviousBalance)
		moneytest.Equal(t, 0, f.cardBalances(t, card.Id)["DOP"])

		f.charge(t, card.Id, "DOP", 100)
		moneytest.Equal(t, -100, f.cardBalances(t, card.Id)["DOP"])
	})

	t.Run("reconciling a card to its statement debt", func(t *testing.T) {
		f := newCardLedgerFixture(t)
		card, err := f.cards.CreateCreditCard(ctx, &creditcardDto.CreateCreditCardRequest{
			Name: "Visa", Bank: "BHD", CutDay: 10, DueDay: 25,
			Balances: []creditcardDto.CreateBalanceRequest{{Currency: "DOP", CreditLimit: money.FromInt(50_000)}},
		}, f.userId)
		require.NoError(t, err)
		f.charge(t, card.Id, "DOP", 36_462)

		// Months without data: the statement says the card owes 8,300.
		result, err := f.accounts.Reconcile(ctx, card.Id, f.userId, accountService.ReconcileInput{BankBalance: money.FromInt(-8_300)})
		require.NoError(t, err)
		assert.True(t, result.Adjusted)
		moneytest.Equal(t, -8_300, f.cardBalances(t, card.Id)["DOP"])
	})

	t.Run("deleting a card removes its bookkeeping; charges still block it", func(t *testing.T) {
		f := newCardLedgerFixture(t)
		db := SetUpTest()
		create := func(name string) string {
			t.Helper()
			card, err := f.cards.CreateCreditCard(ctx, &creditcardDto.CreateCreditCardRequest{
				Name: name, Bank: "BHD", CutDay: 10, DueDay: 25,
				Balances: []creditcardDto.CreateBalanceRequest{{Currency: "DOP", CreditLimit: money.FromInt(5_000), InitialDebt: money.FromInt(700)}},
			}, f.userId)
			require.NoError(t, err)
			_, err = f.cards.CreatePayment(ctx, card.Id, f.userId, &creditcardDto.CreatePaymentRequest{
				FromAccountId: f.bankId, Currency: "DOP", Amount: money.FromInt(200),
			})
			require.NoError(t, err)
			return card.Id
		}
		count := func(accountId string) int {
			t.Helper()
			var n int
			require.NoError(t, db.QueryRow(`SELECT COUNT(*) FROM transactions WHERE account_id = $1`, accountId).Scan(&n))
			return n
		}

		clean := create("Sin compras")
		require.NoError(t, inRequestTx(ctx, db, func(ctx context.Context) error {
			return f.cards.DeleteCreditCard(ctx, clean, f.userId)
		}))
		assert.Zero(t, count(clean))
		_, err := f.cards.FindCardById(ctx, clean, f.userId)
		assert.ErrorIs(t, err, creditcardService.ErrCardNotFound)
		// The paying account keeps its card_payment.
		bank, err := f.accounts.FindById(ctx, f.bankId, f.userId)
		require.NoError(t, err)
		moneytest.Equal(t, 99_800, bank.CurrentBalance)

		withCharges := create("Con compras")
		f.charge(t, withCharges, "DOP", 50)
		before := count(withCharges)
		err = inRequestTx(ctx, db, func(ctx context.Context) error {
			return f.cards.DeleteCreditCard(ctx, withCharges, f.userId)
		})
		require.Error(t, err)
		// The request rolled back: nothing of the card was lost.
		assert.Equal(t, before, count(withCharges))
		moneytest.Equal(t, -550, f.cardBalances(t, withCharges)["DOP"])
	})
}
