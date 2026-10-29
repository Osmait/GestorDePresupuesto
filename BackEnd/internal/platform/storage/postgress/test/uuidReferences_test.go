package postgress

import (
	"context"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/osmait/gestorDePresupuesto/internal/domain/account"
	"github.com/osmait/gestorDePresupuesto/internal/domain/category"
	"github.com/osmait/gestorDePresupuesto/internal/domain/creditcard"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money/moneytest"
	"github.com/osmait/gestorDePresupuesto/internal/domain/transaction"
	creditcardDto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/creditcard"
	"github.com/osmait/gestorDePresupuesto/internal/platform/i18n"
	accountRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/account"
	categoryRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/category"
	creditcardRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/creditcard"
	transactionRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/transaction"
	userRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/user"
	"github.com/osmait/gestorDePresupuesto/internal/platform/utils"
	creditcardService "github.com/osmait/gestorDePresupuesto/internal/services/creditcard"
)

// repoTransactions writes ledger transactions through the real repository,
// keeping the category chosen by the service.
type repoTransactions struct {
	repo *transactionRepo.TransactionRepository
}

func (s *repoTransactions) CreateTransaction(ctx context.Context, name, description string, amount money.Amount, typeTransaction string, accountId string, userId string, categoryId string, budgetId string, currency string, createdAt time.Time) error {
	_, err := s.CreateTransactionWithID(ctx, name, description, amount, typeTransaction, accountId, userId, categoryId, budgetId, currency, createdAt)
	return err
}

func (s *repoTransactions) CreateTransactionWithID(ctx context.Context, name, description string, amount money.Amount, typeTransaction string, accountId string, userId string, categoryId string, _ string, currency string, createdAt time.Time) (string, error) {
	txn := transaction.NewTransaction(newID(), name, description, typeTransaction, accountId, categoryId, amount)
	txn.UserId = userId
	txn.Currency = currency
	txn.CreatedAt = createdAt
	return txn.Id, s.repo.Save(ctx, txn)
}

func (s *repoTransactions) DeleteTransaction(context.Context, string, string) error { return nil }

// Regression: the demo account (services/auth) has a 36-char UUID id, and
// paying a card from it failed with "value too long for type character
// varying(32)" on card_payments.from_account_id. User, paying account and card
// all use UUIDs here; the payment is made in Spanish and then in English.
func TestCreditCardPayment_FromUUIDAccount(t *testing.T) {
	db := SetUpTest()
	ctx := context.Background()

	user := utils.GetNewRandomUser()
	user.Id = uuid.New().String()
	require.NoError(t, userRepo.NewUserRepository(db).Save(ctx, user))

	accounts := accountRepo.NewAccountRepository(db)
	bank := account.NewAccount(money.FromInt(10_000), uuid.New().String(), "Demo", "Banco Demo")
	bank.UserId = user.Id
	require.NoError(t, accounts.Save(ctx, bank))
	require.Len(t, bank.Id, 36)

	cardAccount := account.NewCreditCardAccount(uuid.New().String(), "Visa", "BHD")
	cardAccount.UserId = user.Id
	require.NoError(t, accounts.Save(ctx, cardAccount))

	cards := creditcardRepo.NewCreditCardRepository(db)
	require.NoError(t, cards.SaveCard(ctx, creditcard.NewCreditCard(cardAccount.Id, "BHD", "4242", 10, 20)))
	balance := creditcard.NewCardBalance(newID(), cardAccount.Id, "DOP", money.FromInt(50_000))
	require.NoError(t, cards.SaveBalance(ctx, balance))
	debtCat := category.NewCategory(newID(), "Ajuste", "i", "#fff")
	debtCat.UserId = user.Id
	require.NoError(t, categoryRepo.NewCategoryRepository(db).Save(ctx, debtCat))
	debt := transaction.NewTransaction(newID(), "Ajuste de saldo", "", account.AdjustmentOut, cardAccount.Id, debtCat.Id, money.FromInt(1000))
	debt.UserId, debt.Currency, debt.CreatedAt = user.Id, "DOP", time.Now()
	require.NoError(t, transactionRepo.NewTransactionRepository(db).Save(ctx, debt))

	service := creditcardService.NewCreditCardService(cards, accounts, &repoTransactions{repo: transactionRepo.NewTransactionRepository(db)})
	pay := func(ctx context.Context) {
		t.Helper()
		require.NoError(t, inRequestTx(ctx, db, func(ctx context.Context) error {
			_, err := service.CreatePayment(ctx, cardAccount.Id, user.Id, &creditcardDto.CreatePaymentRequest{
				FromAccountId: bank.Id,
				Currency:      "DOP",
				Amount:        money.FromInt(100),
			})
			return err
		}))
	}
	pay(context.Background())                           // default locale: es
	pay(i18n.WithLocale(context.Background(), i18n.EN)) // en

	payments, err := cards.FindPaymentsByCard(ctx, cardAccount.Id, user.Id)
	require.NoError(t, err)
	require.Len(t, payments, 2)
	for _, p := range payments {
		assert.Equal(t, bank.Id, p.FromAccountId)
		assert.Equal(t, cardAccount.Id, p.CardId)
	}

	cardBalance, err := accounts.BalanceByCurrency(ctx, cardAccount.Id, user.Id, "DOP")
	require.NoError(t, err)
	moneytest.Equal(t, -800, cardBalance)

	rows, err := db.QueryContext(ctx, `SELECT transaction_name, transaction_description, category_id FROM transactions WHERE account_id = $1 ORDER BY transaction_name`, bank.Id)
	require.NoError(t, err)
	defer func() { _ = rows.Close() }()
	type ledgerRow struct{ name, description, categoryID string }
	var ledger []ledgerRow
	for rows.Next() {
		var r ledgerRow
		require.NoError(t, rows.Scan(&r.name, &r.description, &r.categoryID))
		ledger = append(ledger, r)
	}
	require.NoError(t, rows.Err())
	paymentCategory := creditcardRepo.PaymentCategoryID(user.Id)
	assert.Equal(t, []ledgerRow{
		{"Card payment", "Payment to BHD card", paymentCategory},
		{"Pago de tarjeta", "Pago a tarjeta BHD", paymentCategory},
	}, ledger)

	// Both languages share the one card payment category, named in the
	// language of the first payment.
	var count int
	var name string
	require.NoError(t, db.QueryRowContext(ctx, `SELECT COUNT(*), MIN(name) FROM categorys WHERE user_id = $1 AND id <> $2`, user.Id, debtCat.Id).Scan(&count, &name))
	assert.Equal(t, 1, count)
	assert.Equal(t, "Pago de tarjeta", name)
}

// Migration 000051: every column holding an account/user/transaction id is
// unbounded, like the keys it references (account.id, users.id, ...).
func TestReferenceIdColumnsAreUnbounded(t *testing.T) {
	db := SetUpTest()
	columns := [][2]string{
		{"credit_cards", "account_id"},
		{"card_balances", "card_id"},
		{"card_balance_resets", "card_id"},
		{"card_payments", "card_id"},
		{"card_payments", "from_account_id"},
		{"certificates", "payout_account_id"},
		{"certificates", "user_id"},
		{"certificate_payments", "payout_account_id"},
		{"certificate_payments", "transaction_id"},
		{"certificate_payments", "user_id"},
		{"loans", "source_account_id"},
		{"loan_payments", "destination_account_id"},
		{"user_api_keys", "user_id"},
		{"reconciliation_items", "extracted_transaction_id"},
		{"reconciliation_items", "linked_transaction_id"},
		{"reconciliation_items", "created_transaction_id"},
	}
	for _, col := range columns {
		var maxLen *int
		require.NoError(t, db.QueryRow(`SELECT character_maximum_length FROM information_schema.columns
			WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`, col[0], col[1]).Scan(&maxLen), col)
		assert.Nil(t, maxLen, "%s.%s must be unbounded VARCHAR", col[0], col[1])
	}

	// The RLS policies dropped to alter the columns are back.
	for _, policy := range []string{"credit_cards_isolation", "card_balances_isolation", "card_payments_isolation",
		"card_balance_resets_isolation", "certificates_isolation", "certificate_payments_isolation", "user_api_keys_isolation"} {
		var n int
		require.NoError(t, db.QueryRow(`SELECT COUNT(*) FROM pg_policies WHERE policyname = $1`, policy).Scan(&n))
		assert.Equal(t, 1, n, policy)
	}
}

// System categories are identified by their deterministic id, so the request
// language never creates a duplicate; only a new row takes the locale's name.
func TestCategoryRepository_EnsureSystemCategory(t *testing.T) {
	db := SetUpTest()
	ctx := context.Background()
	repo := categoryRepo.NewCategoryRepository(db)
	es := i18n.WithLocale(ctx, i18n.ES)
	en := i18n.WithLocale(ctx, i18n.EN)

	newUser := func() string {
		user := utils.GetNewRandomUser()
		require.NoError(t, userRepo.NewUserRepository(db).Save(ctx, user))
		return user.Id
	}
	nameAndCount := func(userID string) (string, int) {
		var name string
		var count int
		require.NoError(t, db.QueryRowContext(ctx, `SELECT MIN(name), COUNT(*) FROM categorys WHERE user_id = $1`, userID).Scan(&name, &count))
		return name, count
	}

	t.Run("same row in every language, Spanish name with accents", func(t *testing.T) {
		userID := newUser()
		first, err := repo.EnsureSystemCategory(es, userID, category.SystemLoansGranted)
		require.NoError(t, err)
		assert.Equal(t, category.SystemLoansGranted.ID(userID), first)
		second, err := repo.EnsureSystemCategory(en, userID, category.SystemLoansGranted)
		require.NoError(t, err)
		third, err := repo.EnsureSystemCategory(ctx, userID, category.SystemLoansGranted)
		require.NoError(t, err)
		assert.Equal(t, first, second)
		assert.Equal(t, first, third)
		name, count := nameAndCount(userID)
		assert.Equal(t, "Préstamos otorgados", name)
		assert.Equal(t, 1, count)
	})

	t.Run("created in English", func(t *testing.T) {
		userID := newUser()
		_, err := repo.EnsureSystemCategory(en, userID, category.SystemLoansGranted)
		require.NoError(t, err)
		_, err = repo.EnsureSystemCategory(es, userID, category.SystemLoansGranted)
		require.NoError(t, err)
		name, count := nameAndCount(userID)
		assert.Equal(t, "Loans granted", name)
		assert.Equal(t, 1, count)
	})

	t.Run("adopts a legacy unaccented row", func(t *testing.T) {
		userID := newUser()
		legacy := category.NewCategory(newID(), "Prestamos otorgados", "💸", "#0ea5e9")
		legacy.UserId = userID
		require.NoError(t, repo.Save(ctx, legacy))
		id, err := repo.EnsureSystemCategory(en, userID, category.SystemLoansGranted)
		require.NoError(t, err)
		assert.Equal(t, legacy.Id, id)
		_, count := nameAndCount(userID)
		assert.Equal(t, 1, count)
	})

	t.Run("card payment keeps the backfill id in English", func(t *testing.T) {
		userID := newUser()
		id, err := creditcardRepo.NewCreditCardRepository(db).EnsurePaymentCategory(en, userID)
		require.NoError(t, err)
		assert.Equal(t, creditcardRepo.PaymentCategoryID(userID), id)
		again, err := creditcardRepo.NewCreditCardRepository(db).EnsurePaymentCategory(es, userID)
		require.NoError(t, err)
		assert.Equal(t, id, again)
		name, count := nameAndCount(userID)
		assert.Equal(t, "Card payment", name)
		assert.Equal(t, 1, count)
	})
}
