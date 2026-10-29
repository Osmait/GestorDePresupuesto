package postgress

import (
	"context"
	"database/sql"
	"fmt"
	"math/rand"
	"net/url"
	"os"
	"sort"
	"strconv"
	"sync"
	"testing"
	"time"

	"github.com/lib/pq"
	"github.com/stretchr/testify/require"

	"github.com/osmait/gestorDePresupuesto/internal/domain/account"
	"github.com/osmait/gestorDePresupuesto/internal/domain/category"
	"github.com/osmait/gestorDePresupuesto/internal/domain/creditcard"
	"github.com/osmait/gestorDePresupuesto/internal/domain/loan"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
	recurringDomain "github.com/osmait/gestorDePresupuesto/internal/domain/recurring_transaction"
	"github.com/osmait/gestorDePresupuesto/internal/domain/transaction"
	"github.com/osmait/gestorDePresupuesto/internal/platform/cache"
	creditcardDto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/creditcard"
	loanDto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/loan"
	accountRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/account"
	budgetRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/budget"
	categoryRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/category"
	creditcardRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/creditcard"
	investmentRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/investment"
	loanRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/loan"
	notificationRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/notification"
	recurringRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/recurring_transaction"
	transactionRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/transaction"
	"github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/txhelper"
	userRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/user"
	"github.com/osmait/gestorDePresupuesto/internal/platform/utils"
	creditcardService "github.com/osmait/gestorDePresupuesto/internal/services/creditcard"
	"github.com/osmait/gestorDePresupuesto/internal/services/errorhttp"
	"github.com/osmait/gestorDePresupuesto/internal/services/funds"
	investmentService "github.com/osmait/gestorDePresupuesto/internal/services/investment"
	loanService "github.com/osmait/gestorDePresupuesto/internal/services/loan"
	notificationService "github.com/osmait/gestorDePresupuesto/internal/services/notification"
	recurringService "github.com/osmait/gestorDePresupuesto/internal/services/recurring_transaction"
	transactionService "github.com/osmait/gestorDePresupuesto/internal/services/transaction"
)

// ---------------------------------------------------------------------------
// Reference implementation: the ledger SUM queries the repositories used
// before account_balances (migration 000052), plus adjustment_in (migration
// 000058). The oracle the trigger-maintained balances must always agree with.
// ---------------------------------------------------------------------------

const legacySignedAmount = `CASE
    WHEN type_transation IN ('income','loan_collection','loan_cancellation_refund','adjustment_in')
    THEN amount
    ELSE -amount
END`

// legacyBalance is the old AccountRepository.Balance.
func legacyBalance(t *testing.T, q *sql.DB, accountID, userID string) money.Amount {
	t.Helper()
	var total money.Amount
	require.NoError(t, q.QueryRow(`SELECT COALESCE(SUM(`+legacySignedAmount+`), 0) AS TOTAL
FROM transactions
WHERE account_id = $1 AND user_id = $2`, accountID, userID).Scan(&total))
	return total
}

// legacyBalanceByCurrency is the old AccountRepository.BalanceByCurrency /
// TransactionRepository.BalanceByAccountAndCurrency.
func legacyBalanceByCurrency(t *testing.T, q *sql.DB, accountID, userID, currency string) money.Amount {
	t.Helper()
	var total money.Amount
	require.NoError(t, q.QueryRow(`SELECT COALESCE(SUM(`+legacySignedAmount+`), 0) FROM transactions WHERE account_id = $1 AND user_id = $3 AND (currency = $2 OR ($2 = 'DOP' AND currency IS NULL))`,
		accountID, currency, userID).Scan(&total))
	return total
}

// legacyBalances is the old AccountRepository.Balances.
func legacyBalances(t *testing.T, q *sql.DB, userID string) map[string]money.Amount {
	t.Helper()
	rows, err := q.Query(`SELECT account_id, COALESCE(SUM(`+legacySignedAmount+`), 0) AS TOTAL FROM transactions WHERE user_id = $1 GROUP BY account_id`, userID)
	require.NoError(t, err)
	defer func() { _ = rows.Close() }()
	out := map[string]money.Amount{}
	for rows.Next() {
		var id string
		var total money.Amount
		require.NoError(t, rows.Scan(&id, &total))
		out[id] = total
	}
	require.NoError(t, rows.Err())
	return out
}

type balanceKey struct{ account, currency string }

// legacyBalancesByCurrency is the ledger SUM per (account, currency) of one
// user, with a NULL currency counted as DOP.
func legacyBalancesByCurrency(t *testing.T, q *sql.DB, userID string) map[balanceKey]money.Amount {
	t.Helper()
	return scanBalanceRows(t, q, `SELECT account_id, COALESCE(currency, 'DOP'), SUM(`+legacySignedAmount+`)
FROM transactions WHERE user_id = $1 GROUP BY account_id, COALESCE(currency, 'DOP')`, userID)
}

func storedBalances(t *testing.T, q *sql.DB, userID string) map[balanceKey]money.Amount {
	t.Helper()
	return scanBalanceRows(t, q, `SELECT account_id, currency, SUM(balance) FROM account_balances WHERE user_id = $1 GROUP BY account_id, currency`, userID)
}

func scanBalanceRows(t *testing.T, q *sql.DB, query string, args ...any) map[balanceKey]money.Amount {
	t.Helper()
	rows, err := q.Query(query, args...)
	require.NoError(t, err)
	defer func() { _ = rows.Close() }()
	out := map[balanceKey]money.Amount{}
	for rows.Next() {
		var k balanceKey
		var v money.Amount
		require.NoError(t, rows.Scan(&k.account, &k.currency, &v))
		out[k] = v
	}
	require.NoError(t, rows.Err())
	return out
}

// requireStoredMatchesLedger compares account_balances with the ledger SUM for
// every (account, currency) of userID; a missing row counts as zero.
func requireStoredMatchesLedger(t *testing.T, db *sql.DB, userID string, msgAndArgs ...any) {
	t.Helper()
	stored := storedBalances(t, db, userID)
	ledger := legacyBalancesByCurrency(t, db, userID)
	keys := map[balanceKey]bool{}
	for k := range stored {
		keys[k] = true
	}
	for k := range ledger {
		keys[k] = true
	}
	var diffs []string
	for k := range keys {
		if !stored[k].Equal(ledger[k]) {
			diffs = append(diffs, fmt.Sprintf("%s/%s stored=%s ledger=%s", k.account, k.currency, stored[k], ledger[k]))
		}
	}
	sort.Strings(diffs)
	if len(diffs) > 0 {
		require.Failf(t, "stored balances differ from the ledger", "user %s: %v %v", userID, diffs, fmt.Sprint(msgAndArgs...))
	}
}

// requireRepositoryReadsMatchLegacy checks every repository balance read
// against its old SUM-based query.
func requireRepositoryReadsMatchLegacy(t *testing.T, db *sql.DB, userID string, accountIDs []string) {
	t.Helper()
	ctx := context.Background()
	accounts := accountRepo.NewAccountRepository(db)
	transactions := transactionRepo.NewTransactionRepository(db)

	got, err := accounts.Balances(ctx, userID)
	require.NoError(t, err)
	want := legacyBalances(t, db, userID)
	for _, id := range accountIDs {
		require.Truef(t, want[id].Equal(got[id]), "Balances[%s] = %s, ledger %s", id, got[id], want[id])
	}

	for _, id := range accountIDs {
		b, err := accounts.Balance(ctx, id, userID)
		require.NoError(t, err)
		require.Truef(t, legacyBalance(t, db, id, userID).Equal(b), "Balance(%s) = %s", id, b)
		for _, cur := range []string{"DOP", "USD", "EUR"} {
			byCur, err := accounts.BalanceByCurrency(ctx, id, userID, cur)
			require.NoError(t, err)
			wantCur := legacyBalanceByCurrency(t, db, id, userID, cur)
			require.Truef(t, wantCur.Equal(byCur), "BalanceByCurrency(%s, %s) = %s, ledger %s", id, cur, byCur, wantCur)
			txByCur, err := transactions.BalanceByAccountAndCurrency(ctx, id, userID, cur)
			require.NoError(t, err)
			require.Truef(t, wantCur.Equal(txByCur), "BalanceByAccountAndCurrency(%s, %s) = %s, ledger %s", id, cur, txByCur, wantCur)
		}
	}
}

// ---------------------------------------------------------------------------
// Randomized ledger: every kind of write that moves money, checked against
// the SUM oracle after each step.
// ---------------------------------------------------------------------------

var allTransactionTypes = []string{
	"bill", "income", "loan_disbursement", "loan_collection", "investment_purchase",
	"investment_funding", "card_payment", "loan_cancellation_refund",
	"adjustment_in", "adjustment_out",
}

type ledgerUser struct {
	id         string
	bankDOP    string
	bankUSD    string
	card       string
	categoryID string
	accounts   []string
	loans      []fuzzLoan
}

type fuzzLoan struct{ id, currency string }

func seedLedgerUser(t *testing.T, db *sql.DB) *ledgerUser {
	t.Helper()
	ctx := context.Background()
	user := utils.GetNewRandomUser()
	require.NoError(t, userRepo.NewUserRepository(db).Save(ctx, user))
	u := &ledgerUser{id: user.Id}

	accounts := accountRepo.NewAccountRepository(db)
	dop := account.NewAccount(money.FromInt(1_000_000), newID(), "Checking", "Bank")
	dop.UserId = u.id
	require.NoError(t, accounts.Save(ctx, dop))
	usd := account.NewAccount(money.FromInt(50_000), newID(), "Dollars", "Bank")
	usd.UserId = u.id
	usd.Currency = "USD"
	require.NoError(t, accounts.Save(ctx, usd))
	card := account.NewCreditCardAccount(newID(), "Visa", "Bank")
	card.UserId = u.id
	require.NoError(t, accounts.Save(ctx, card))

	cards := creditcardRepo.NewCreditCardRepository(db)
	require.NoError(t, cards.SaveCard(ctx, creditcard.NewCreditCard(card.Id, "Bank", "4242", 10, 20)))
	for _, cur := range []string{"DOP", "USD"} {
		b := creditcard.NewCardBalance(newID(), card.Id, cur, money.FromInt(100_000))
		b.CurrentBalance = money.FromInt(-5_000)
		require.NoError(t, cards.SaveBalance(ctx, b))
	}

	cat := category.NewCategory(newID(), "Misc", "tag", "#123456")
	cat.UserId = u.id
	require.NoError(t, categoryRepo.NewCategoryRepository(db).Save(ctx, cat))

	u.bankDOP, u.bankUSD, u.card, u.categoryID = dop.Id, usd.Id, card.Id, cat.Id
	u.accounts = []string{dop.Id, usd.Id, card.Id}
	return u
}

type fakeClock struct {
	mu  sync.Mutex
	now time.Time
}

func (c *fakeClock) Now() time.Time {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.now
}

func (c *fakeClock) advance(d time.Duration) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.now = c.now.Add(d)
}

type ledgerFuzzer struct {
	t     *testing.T
	db    *sql.DB
	rng   *rand.Rand
	users []*ledgerUser
	clock *fakeClock

	txRepo      *transactionRepo.TransactionRepository
	txService   *transactionService.TransactionService
	cards       *creditcardService.CreditCardService
	loans       *loanService.LoanService
	investments *investmentService.InvestmentService
	recurring   *recurringService.RecurringTransactionService
	recurRepo   *recurringRepo.RecurringTransactionRepository
}

func newLedgerFuzzer(t *testing.T, db *sql.DB, seed int64) *ledgerFuzzer {
	accounts := accountRepo.NewAccountRepository(db)
	categories := categoryRepo.NewCategoryRepository(db)
	txRepo := transactionRepo.NewTransactionRepository(db)
	notifications := notificationService.NewNotificationService(notificationRepo.NewNotificationRepository(db))
	txService := transactionService.NewTransactionService(txRepo, budgetRepo.NewBudgetRepository(db), notifications,
		cache.NewInMemoryCache(time.Minute, time.Minute), nil, nil)
	clock := &fakeClock{now: time.Date(2026, time.January, 15, 15, 0, 0, 0, time.UTC)}
	recurRepo := recurringRepo.NewRecurringTransactionRepository(db)
	return &ledgerFuzzer{
		t: t, db: db, rng: rand.New(rand.NewSource(seed)), clock: clock,
		users:       []*ledgerUser{seedLedgerUser(t, db), seedLedgerUser(t, db)},
		txRepo:      txRepo,
		txService:   txService,
		cards:       creditcardService.NewCreditCardService(creditcardRepo.NewCreditCardRepository(db), accounts, txService),
		loans:       loanService.NewLoanService(loanRepo.NewLoanRepository(db), txService, accounts, categories),
		investments: investmentService.NewInvestmentService(investmentRepo.NewInvestmentRepository(db), nil, txService, accounts, categories),
		recurring: recurringService.NewRecurringTransactionService(recurRepo, txService, notifications,
			recurringService.WithLocation(time.UTC), recurringService.WithClock(clock.Now)),
		recurRepo: recurRepo,
	}
}

func (f *ledgerFuzzer) amount() money.Amount {
	// 0.01 .. 3000.00, occasionally with sub-cent digits (amount is NUMERIC(19,4)).
	cents := int64(f.rng.Intn(300_000) + 1)
	a := money.FromInt(cents).Div(money.FromInt(100))
	if f.rng.Intn(10) == 0 {
		a = a.Add(money.MustParse("0.0037"))
	}
	return a
}

func (f *ledgerFuzzer) pick(xs []string) string { return xs[f.rng.Intn(len(xs))] }

func (f *ledgerFuzzer) currency() string {
	return f.pick([]string{"DOP", "USD", "DOP", "EUR"})
}

// someTransactions returns up to n random transaction ids of u.
func (f *ledgerFuzzer) someTransactions(u *ledgerUser, n int) []string {
	rows, err := f.db.Query(`SELECT id FROM transactions WHERE user_id = $1 ORDER BY id`, u.id)
	require.NoError(f.t, err)
	defer func() { _ = rows.Close() }()
	var ids []string
	for rows.Next() {
		var id string
		require.NoError(f.t, rows.Scan(&id))
		ids = append(ids, id)
	}
	require.NoError(f.t, rows.Err())
	f.rng.Shuffle(len(ids), func(i, j int) { ids[i], ids[j] = ids[j], ids[i] })
	if len(ids) > n {
		ids = ids[:n]
	}
	return ids
}

func (f *ledgerFuzzer) request(fn func(ctx context.Context) error) error {
	return inRequestTx(context.Background(), f.db, fn)
}

func (f *ledgerFuzzer) exec(query string, args ...any) {
	_, err := f.db.Exec(query, args...)
	require.NoError(f.t, err, query)
}

// step performs one random money movement and returns its name.
func (f *ledgerFuzzer) step() string {
	t := f.t
	u := f.users[0]
	if f.rng.Intn(4) == 0 {
		u = f.users[1]
	}
	switch op := f.rng.Intn(17); op {
	case 0, 1, 2: // create through the repository (any type, any currency)
		txn := transaction.NewTransaction(newID(), "fuzz", "", f.pick(allTransactionTypes), f.pick(u.accounts), u.categoryID, f.amount())
		txn.UserId = u.id
		txn.Currency = f.currency()
		txn.CreatedAt = time.Now()
		require.NoError(t, f.request(func(ctx context.Context) error { return f.txRepo.Save(ctx, txn) }))
		return "create"
	case 3: // create with a NULL currency (legacy rows; counted as DOP)
		f.exec(`INSERT INTO transactions (id, transaction_name, amount, type_transation, account_id, user_id, category_id, currency)
			VALUES ($1, 'legacy', $2, $3, $4, $5, $6, NULL)`, newID(), f.amount(), f.pick(allTransactionTypes), f.pick(u.accounts), u.id, u.categoryID)
		return "create-null-currency"
	case 4, 5: // update: amount / type / account / currency, any combination
		ids := f.someTransactions(u, 1)
		if len(ids) == 0 {
			return "update-skip"
		}
		var cur sql.NullString
		txn := &transaction.Transaction{UserId: u.id, CategoryId: u.categoryID, Name: "updated"}
		require.NoError(t, f.db.QueryRow(`SELECT amount, type_transation, account_id, currency FROM transactions WHERE id = $1`, ids[0]).
			Scan(&txn.Amount, &txn.TypeTransation, &txn.AccountId, &cur))
		txn.Currency = cur.String
		if f.rng.Intn(2) == 0 {
			txn.Amount = f.amount()
		}
		if f.rng.Intn(2) == 0 {
			txn.TypeTransation = f.pick(allTransactionTypes)
		}
		if f.rng.Intn(2) == 0 {
			txn.AccountId = f.pick(u.accounts)
		}
		if f.rng.Intn(2) == 0 {
			txn.Currency = f.currency()
		}
		require.NoError(t, f.request(func(ctx context.Context) error { return f.txRepo.Update(ctx, ids[0], txn) }))
		return "update"
	case 6: // update that does not touch money columns
		for _, id := range f.someTransactions(u, 3) {
			f.exec(`UPDATE transactions SET transaction_name = transaction_name || '!', created_at = created_at - interval '1 day' WHERE id = $1`, id)
		}
		return "update-name"
	case 7: // delete through the repository
		for _, id := range f.someTransactions(u, 1) {
			require.NoError(t, f.request(func(ctx context.Context) error { return f.txRepo.Delete(ctx, id, u.id) }))
		}
		return "delete"
	case 8: // multi-row statements: move, flip types, change currency, delete
		ids := f.someTransactions(u, 5)
		switch f.rng.Intn(4) {
		case 0:
			f.exec(`UPDATE transactions SET account_id = $1 WHERE id = ANY($2)`, f.pick(u.accounts), pq.Array(ids))
		case 1:
			f.exec(`UPDATE transactions SET type_transation = CASE WHEN type_transation = 'income' THEN 'bill'::TypeTransaction ELSE 'income'::TypeTransaction END WHERE id = ANY($1)`, pq.Array(ids))
		case 2:
			f.exec(`UPDATE transactions SET currency = CASE WHEN currency IS NULL THEN 'USD' WHEN currency = 'USD' THEN NULL ELSE 'USD' END, amount = amount + 1 WHERE id = ANY($1)`, pq.Array(ids))
		default:
			f.exec(`DELETE FROM transactions WHERE id = ANY($1)`, pq.Array(ids))
		}
		return "bulk"
	case 9: // writes rolled back with their request
		err := f.request(func(ctx context.Context) error {
			txn := transaction.NewTransaction(newID(), "rolled back", "", "income", u.bankDOP, u.categoryID, money.FromInt(999))
			txn.UserId = u.id
			if err := f.txRepo.Save(ctx, txn); err != nil {
				return err
			}
			for _, id := range f.someTransactions(u, 2) {
				if err := f.txRepo.Delete(ctx, id, u.id); err != nil {
					return err
				}
			}
			return fmt.Errorf("rollback")
		})
		require.EqualError(t, err, "rollback")
		return "rollback"
	case 10: // move a transaction to the other user (user_id and account change)
		other := f.users[0]
		if other == u {
			other = f.users[1]
		}
		for _, id := range f.someTransactions(u, 1) {
			f.exec(`UPDATE transactions SET user_id = $1, account_id = $2, category_id = $3 WHERE id = $4`, other.id, f.pick(other.accounts), other.categoryID, id)
		}
		return "move-user"
	case 11: // credit-card payment, same currency or converted, with or without interest
		req := &creditcardDto.CreatePaymentRequest{FromAccountId: u.bankDOP, Currency: "DOP", Amount: f.amount().RoundCents()}
		if req.Amount.IsZero() {
			req.Amount = money.FromInt(1)
		}
		switch f.rng.Intn(3) {
		case 1:
			req.Currency, req.ExchangeRate = "USD", money.MustParse("60.25")
		case 2:
			req.FromAccountId, req.ExchangeRate = u.bankUSD, money.MustParse("59.5")
		}
		if f.rng.Intn(3) == 0 {
			req.IncludesInterest, req.InterestAmount = true, money.MustParse("12.34")
		}
		err := f.request(func(ctx context.Context) error {
			_, err := f.cards.CreatePayment(ctx, u.card, u.id, req)
			return err
		})
		requireNilOrInsufficient(t, err)
		return "card-payment"
	case 12: // loan disbursement from the account in the loan's currency
		cur, source := "DOP", u.bankDOP
		if f.rng.Intn(3) == 0 {
			cur, source = "USD", u.bankUSD
		}
		var resp *loanDto.LoanResponse
		err := f.request(func(ctx context.Context) error {
			var err error
			resp, err = f.loans.CreateLoan(ctx, &loanDto.CreateLoanRequest{
				BorrowerName: "Bob", PrincipalAmount: f.amount().RoundCents().Add(money.FromInt(1)), Currency: cur,
				InterestMode: string(loan.InterestModeNone), TermMonths: 3, SourceAccountId: source,
			}, u.id)
			return err
		})
		requireNilOrInsufficient(t, err)
		if err == nil {
			u.loans = append(u.loans, fuzzLoan{id: resp.Id, currency: cur})
		}
		return "loan-disbursement"
	case 13: // loan collection into the account in the loan's currency
		if len(u.loans) == 0 {
			return "loan-collection-skip"
		}
		l := u.loans[f.rng.Intn(len(u.loans))]
		dest := u.bankDOP
		if l.currency == "USD" {
			dest = u.bankUSD
		}
		err := f.request(func(ctx context.Context) error {
			_, err := f.loans.RegisterPayment(ctx, l.id, u.id, &loanDto.RegisterLoanPaymentRequest{
				DestinationAccountId: dest, Amount: money.MustParse("0.75"),
			})
			return err
		})
		requireNilOrBadRequest(t, err) // paid off / no longer active
		return "loan-collection"
	case 14: // loan cancellation refund
		if len(u.loans) == 0 {
			return "loan-cancel-skip"
		}
		i := f.rng.Intn(len(u.loans))
		loanID := u.loans[i].id
		err := f.request(func(ctx context.Context) error { return f.loans.CancelLoan(ctx, loanID, u.id) })
		requireNilOrBadRequest(t, err) // already paid off
		u.loans = append(u.loans[:i], u.loans[i+1:]...)
		return "loan-cancel"
	case 15: // broker funding (same currency or converted)
		req := investmentService.FundingRequest{SourceAccountID: u.bankDOP, SourceAmount: f.amount().RoundCents().Add(money.FromInt(1)), TargetCurrency: "DOP"}
		if f.rng.Intn(2) == 0 {
			req.TargetCurrency, req.ExchangeRate = "USD", money.MustParse("60")
		}
		if f.rng.Intn(3) == 0 {
			req.FeeAmount = money.MustParse("2.50")
		}
		err := f.request(func(ctx context.Context) error { return f.investments.FundBroker(ctx, u.id, req) })
		requireNilOrInsufficient(t, err)
		return "broker-funding"
	default: // recurring rules executed by the scheduler (its own transactions)
		if f.rng.Intn(2) == 0 {
			rule := recurringDomain.NewRecurringTransaction("", u.id, "Rent", "", f.amount().RoundCents().Add(money.FromInt(1)),
				f.pick([]string{"bill", "income"}), f.pick([]string{u.bankDOP, u.bankUSD}), u.categoryID, nil, f.rng.Intn(28)+1)
			require.NoError(t, f.recurring.Create(context.Background(), rule))
		}
		f.clock.advance(time.Duration(f.rng.Intn(40)+1) * 24 * time.Hour)
		require.NoError(t, f.recurring.ProcessDueTransactionsForUser(context.Background(), u.id))
		return "recurring"
	}
}

func requireNilOrBadRequest(t *testing.T, err error) {
	t.Helper()
	if err != nil {
		require.ErrorIs(t, err, errorhttp.ErrBadRequest)
	}
}

func requireNilOrInsufficient(t *testing.T, err error) {
	t.Helper()
	if err != nil {
		require.ErrorIs(t, err, funds.ErrInsufficientFunds)
	}
}

// TestAccountBalances_RandomizedLedgerMatchesSum runs a random sequence of
// money movements (creates, updates incl. type/account/currency/user changes,
// deletes, multi-row statements, rollbacks, card payments, loan disbursement /
// collection / cancellation, broker funding, recurring execution) and after
// every step requires the stored balances to equal the old ledger SUM for
// every account and currency. BALANCE_FUZZ_SEED / BALANCE_FUZZ_STEPS override
// the seed and length.
func TestAccountBalances_RandomizedLedgerMatchesSum(t *testing.T) {
	db := SetUpTest()
	seed := time.Now().UnixNano()
	if s, err := strconv.ParseInt(os.Getenv("BALANCE_FUZZ_SEED"), 10, 64); err == nil {
		seed = s
	}
	steps := 400
	if n, err := strconv.Atoi(os.Getenv("BALANCE_FUZZ_STEPS")); err == nil && n > 0 {
		steps = n
	}
	t.Logf("seed %d, %d steps (reproduce with BALANCE_FUZZ_SEED=%d)", seed, steps, seed)

	f := newLedgerFuzzer(t, db, seed)
	t.Cleanup(func() {
		for _, u := range f.users {
			_, _ = db.Exec(`DELETE FROM recurring_transactions WHERE user_id = $1`, u.id)
		}
	})
	counts := map[string]int{}
	for i := 0; i < steps; i++ {
		op := f.step()
		counts[op]++
		for _, u := range f.users {
			requireStoredMatchesLedger(t, db, u.id, "after step ", i, " (", op, "), seed ", seed)
		}
		if i%50 == 49 {
			for _, u := range f.users {
				requireRepositoryReadsMatchLegacy(t, db, u.id, u.accounts)
			}
		}
	}
	for _, u := range f.users {
		requireRepositoryReadsMatchLegacy(t, db, u.id, u.accounts)
	}
	t.Logf("operations: %v", counts)
}

// ---------------------------------------------------------------------------
// FORCE ROW LEVEL SECURITY with a role that does not bypass it.
// ---------------------------------------------------------------------------

// openRLSRole returns a pool for a fresh LOGIN role that is neither superuser,
// table owner nor BYPASSRLS, so every FORCE RLS policy applies to it.
func openRLSRole(t *testing.T) *sql.DB {
	t.Helper()
	role := "rls_app_" + newID()[:10]
	for _, stmt := range []string{
		`CREATE ROLE ` + pq.QuoteIdentifier(role) + ` LOGIN PASSWORD 'rls' NOSUPERUSER NOBYPASSRLS`,
		`GRANT USAGE ON SCHEMA public TO ` + pq.QuoteIdentifier(role),
		`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ` + pq.QuoteIdentifier(role),
		`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ` + pq.QuoteIdentifier(role),
	} {
		_, err := testDB.Exec(stmt)
		require.NoError(t, err, stmt)
	}
	dsn, err := url.Parse(testConnStr)
	require.NoError(t, err)
	dsn.User = url.UserPassword(role, "rls")
	db, err := sql.Open("postgres", dsn.String())
	require.NoError(t, err)
	t.Cleanup(func() {
		_ = db.Close()
		_, _ = testDB.Exec(`DROP OWNED BY ` + pq.QuoteIdentifier(role))
		_, _ = testDB.Exec(`DROP ROLE IF EXISTS ` + pq.QuoteIdentifier(role))
	})
	var bypass bool
	require.NoError(t, db.QueryRow(`SELECT rolbypassrls OR rolsuper FROM pg_roles WHERE rolname = current_user`).Scan(&bypass))
	require.False(t, bypass)
	return db
}

// asUser runs fn in a transaction on db with the RLS settings RLSMiddleware sets.
func asUser(db *sql.DB, userID string, fn func(ctx context.Context) error) error {
	return inRequestTx(context.Background(), db, func(ctx context.Context) error {
		q := txhelper.FromContext(ctx, db)
		if _, err := q.ExecContext(ctx, `SELECT set_config('app.current_user_id', $1, true), set_config('app.is_admin', 'false', true)`, userID); err != nil {
			return err
		}
		return fn(ctx)
	})
}

// TestAccountBalances_TriggersUnderForcedRLS writes and reads through a role
// subject to FORCE ROW LEVEL SECURITY: the triggers must maintain the balance
// rows in the writer's own RLS context, and the rows must be isolated per user
// exactly like the ledger.
func TestAccountBalances_TriggersUnderForcedRLS(t *testing.T) {
	alice := seedLedgerUser(t, testDB)
	bob := seedLedgerUser(t, testDB)
	rls := openRLSRole(t)

	txRepo := transactionRepo.NewTransactionRepository(rls)
	accounts := accountRepo.NewAccountRepository(rls)
	ledger := &ledgerTransactionService{repo: txRepo, categoryID: alice.categoryID}
	cards := creditcardService.NewCreditCardService(creditcardRepo.NewCreditCardRepository(rls), accounts, ledger)

	var firstID string
	require.NoError(t, asUser(rls, alice.id, func(ctx context.Context) error {
		for i, typ := range []string{"income", "bill", "card_payment", "loan_collection"} {
			txn := transaction.NewTransaction(newID(), "rls", "", typ, alice.bankDOP, alice.categoryID, money.FromInt(int64(100*(i+1))))
			txn.UserId = alice.id
			txn.CreatedAt = time.Now()
			if err := txRepo.Save(ctx, txn); err != nil {
				return err
			}
			if i == 0 {
				firstID = txn.Id
			}
		}
		// Move the income to the USD account and turn it into a bill.
		if err := txRepo.Update(ctx, firstID, &transaction.Transaction{UserId: alice.id, Name: "moved", Amount: money.FromInt(100),
			TypeTransation: "bill", AccountId: alice.bankUSD, CategoryId: alice.categoryID, Currency: "USD"}); err != nil {
			return err
		}
		_, err := cards.CreatePayment(ctx, alice.card, alice.id, &creditcardDto.CreatePaymentRequest{
			FromAccountId: alice.bankDOP, Currency: "DOP", Amount: money.FromInt(50),
		})
		return err
	}))
	require.NoError(t, asUser(rls, bob.id, func(ctx context.Context) error {
		txn := transaction.NewTransaction(newID(), "bob", "", "income", bob.bankDOP, bob.categoryID, money.FromInt(7))
		txn.UserId = bob.id
		txn.CreatedAt = time.Now()
		return txRepo.Save(ctx, txn)
	}))
	requireStoredMatchesLedger(t, testDB, alice.id)
	requireStoredMatchesLedger(t, testDB, bob.id)

	// Reads through the restricted role see only the current user's rows.
	require.NoError(t, asUser(rls, alice.id, func(ctx context.Context) error {
		got, err := accounts.Balances(ctx, alice.id)
		require.NoError(t, err)
		// -200 bill -300 card_payment +400 loan_collection -50 card payment
		require.Truef(t, money.FromInt(-150).Equal(got[alice.bankDOP]), "alice DOP = %s", got[alice.bankDOP])
		require.Truef(t, money.FromInt(-100).Equal(got[alice.bankUSD]), "alice USD = %s", got[alice.bankUSD])
		leaked, err := accounts.Balances(ctx, bob.id)
		require.NoError(t, err)
		require.Empty(t, leaked, "bob's balances must be invisible to alice")
		return nil
	}))
	var visible int
	require.NoError(t, rls.QueryRow(`SELECT count(*) FROM account_balances`).Scan(&visible))
	require.Zero(t, visible, "no rows without an RLS user")

	// A balance row cannot be forged for another user through the table.
	err := asUser(rls, alice.id, func(ctx context.Context) error {
		_, err := txhelper.FromContext(ctx, rls).ExecContext(ctx, `INSERT INTO account_balances (user_id, account_id, currency, balance) VALUES ($1, $2, 'DOP', 1000000)`, bob.id, bob.bankDOP)
		return err
	})
	require.ErrorContains(t, err, "row-level security")

	// Deletes through the restricted role.
	require.NoError(t, asUser(rls, alice.id, func(ctx context.Context) error { return txRepo.Delete(ctx, firstID, alice.id) }))
	requireStoredMatchesLedger(t, testDB, alice.id)

	// The recurring scheduler (its own transactions, RLS settings per rule) on
	// the restricted role.
	clock := &fakeClock{now: time.Date(2026, time.March, 3, 12, 0, 0, 0, time.UTC)}
	notifications := notificationService.NewNotificationService(notificationRepo.NewNotificationRepository(rls))
	txService := transactionService.NewTransactionService(txRepo, budgetRepo.NewBudgetRepository(rls), notifications,
		cache.NewInMemoryCache(time.Minute, time.Minute), nil, nil)
	scheduler := recurringService.NewRecurringTransactionService(recurringRepo.NewRecurringTransactionRepository(rls), txService, notifications,
		recurringService.WithLocation(time.UTC), recurringService.WithClock(clock.Now))
	rule := recurringDomain.NewRecurringTransaction("", alice.id, "Salary", "", money.FromInt(321), "income", alice.bankDOP, alice.categoryID, nil, 3)
	require.NoError(t, asUser(rls, alice.id, func(ctx context.Context) error { return scheduler.Create(ctx, rule) }))
	t.Cleanup(func() { _, _ = testDB.Exec(`DELETE FROM recurring_transactions WHERE user_id = $1`, alice.id) })
	clock.advance(62 * 24 * time.Hour)
	require.NoError(t, scheduler.ProcessDueTransactions(context.Background()))
	var executed int
	require.NoError(t, testDB.QueryRow(`SELECT count(*) FROM transactions WHERE user_id = $1 AND transaction_name = 'Salary'`, alice.id).Scan(&executed))
	require.Equal(t, 3, executed, "March, April and May occurrences")
	requireStoredMatchesLedger(t, testDB, alice.id)
	requireRepositoryReadsMatchLegacy(t, testDB, alice.id, alice.accounts)
}

// ---------------------------------------------------------------------------
// Card payments: FOR NO KEY UPDATE + O(1) funds check.
// ---------------------------------------------------------------------------

// TestCreditCardPayment_LockDoesNotBlockTransactionInserts holds a payment's
// source-account lock and funds check open and records ordinary transactions
// on the same account from other requests meanwhile. With FOR UPDATE their
// foreign-key FOR KEY SHARE lock waited for the payment to finish; with FOR NO
// KEY UPDATE they must go through immediately.
func TestCreditCardPayment_LockDoesNotBlockTransactionInserts(t *testing.T) {
	db := SetUpTest()
	fx := seedLowBalanceCard(t, db, money.FromInt(100))
	accounts := accountRepo.NewAccountRepository(db)
	txRepo := transactionRepo.NewTransactionRepository(db)

	ctx := context.Background()
	payment, err := db.BeginTx(ctx, nil)
	require.NoError(t, err)
	defer func() { _ = payment.Rollback() }()
	payCtx := txhelper.WithTx(ctx, payment)
	acc, err := accounts.FindByIdAndUserIdForUpdate(payCtx, fx.accountID, fx.userID)
	require.NoError(t, err)
	require.NoError(t, funds.Require(payCtx, accounts, acc, fx.userID, money.FromInt(60)))

	for i, typ := range []string{"bill", "income", "bill"} {
		err := inRequestTx(ctx, db, func(ctx context.Context) error {
			if _, err := txhelper.FromContext(ctx, db).ExecContext(ctx, `SET LOCAL lock_timeout = '2s'`); err != nil {
				return err
			}
			txn := transaction.NewTransaction(newID(), fmt.Sprintf("concurrent %d", i), "", typ, fx.accountID, fx.categoryID, money.FromInt(5))
			txn.UserId = fx.userID
			txn.CreatedAt = time.Now()
			return txRepo.Save(ctx, txn)
		})
		require.NoError(t, err, "a transaction insert waited for the payment's account lock")
	}

	// A second debit of the same account still has to wait for the lock.
	err = inRequestTx(ctx, db, func(ctx context.Context) error {
		if _, err := txhelper.FromContext(ctx, db).ExecContext(ctx, `SET LOCAL lock_timeout = '200ms'`); err != nil {
			return err
		}
		_, err := accounts.FindByIdAndUserIdForUpdate(ctx, fx.accountID, fx.userID)
		return err
	})
	require.ErrorContains(t, err, "lock timeout")

	// The concurrent rows are visible to the payment's next balance read.
	balance, err := funds.CurrentBalance(payCtx, accounts, acc, fx.userID)
	require.NoError(t, err)
	require.Truef(t, money.FromInt(95).Equal(balance), "balance = %s", balance)
	require.NoError(t, payment.Commit())
	requireStoredMatchesLedger(t, db, fx.userID)
}

// TestCreditCardPayment_ConcurrentPaymentsAndInsertsKeepTheGuarantee fires
// payments that do not all fit together at one account while other requests
// record incomes on the same account. Payments stay serialised by the account
// lock, so the guarded debits never overdraw it; nothing deadlocks, no update
// is lost, and the stored balance equals the ledger afterwards.
func TestCreditCardPayment_ConcurrentPaymentsAndInsertsKeepTheGuarantee(t *testing.T) {
	db := SetUpTest()
	fx := seedLowBalanceCard(t, db, money.FromInt(100))
	accounts := accountRepo.NewAccountRepository(db)
	txRepo := transactionRepo.NewTransactionRepository(db)
	ledger := &ledgerTransactionService{repo: txRepo, categoryID: fx.categoryID}
	service := creditcardService.NewCreditCardService(creditcardRepo.NewCreditCardRepository(db), accounts, ledger)

	const payments, incomes = 12, 24
	var fns []func(ctx context.Context) error
	for i := 0; i < payments; i++ {
		fns = append(fns, func(ctx context.Context) error {
			_, err := service.CreatePayment(ctx, fx.cardID, fx.userID, &creditcardDto.CreatePaymentRequest{
				FromAccountId: fx.accountID, Currency: "DOP", Amount: money.FromInt(30), Notes: fmt.Sprintf("payment %d", i),
			})
			return err
		})
	}
	for i := 0; i < incomes; i++ {
		fns = append(fns, func(ctx context.Context) error {
			txn := transaction.NewTransaction(newID(), fmt.Sprintf("income %d", i), "", "income", fx.accountID, fx.categoryID, money.FromInt(1))
			txn.UserId = fx.userID
			txn.CreatedAt = time.Now()
			return txRepo.Save(ctx, txn)
		})
	}
	errs := runConcurrently(db, fns...)
	for _, err := range errs[payments:] {
		require.NoError(t, err, "income inserts must not fail")
	}
	succeeded, insufficient := countOutcomes(t, errs[:payments])
	require.Equal(t, payments, succeeded+insufficient)
	// 100 initial + 24 incomes = at most 124 available: 3 or 4 payments of 30
	// depending on how many incomes committed before each check.
	require.GreaterOrEqual(t, succeeded, 3)
	require.LessOrEqual(t, succeeded, 4)

	requireStoredMatchesLedger(t, db, fx.userID)
	movements, err := accounts.Balance(context.Background(), fx.accountID, fx.userID)
	require.NoError(t, err)
	final := money.FromInt(100).Add(movements)
	require.Truef(t, money.FromInt(124-30*int64(succeeded)).Equal(final), "final balance %s", final)
	require.False(t, final.IsNegative(), "guarded debits overdrew the account")
}

// TestAccountBalances_ConcurrentWritersDoNotQueue keeps a transaction that has
// written to an account open and records another transaction on the same
// account from a second connection: the balance is striped per connection
// slot, so the second writer must not wait for the first one's row lock.
func TestAccountBalances_ConcurrentWritersDoNotQueue(t *testing.T) {
	db := SetUpTest()
	u := seedLedgerUser(t, db)
	txRepo := transactionRepo.NewTransactionRepository(db)
	ctx := context.Background()

	// Two connections whose server processes map to different slots.
	slotOf := func(c *sql.Conn) int {
		var pid int
		require.NoError(t, c.QueryRowContext(ctx, `SELECT pg_backend_pid()`).Scan(&pid))
		return pid % 32
	}
	first, err := db.Conn(ctx)
	require.NoError(t, err)
	defer func() { _ = first.Close() }()
	var second *sql.Conn
	var spare []*sql.Conn
	defer func() {
		for _, c := range spare {
			_ = c.Close()
		}
	}()
	for i := 0; i < 64 && second == nil; i++ {
		c, err := db.Conn(ctx)
		require.NoError(t, err)
		spare = append(spare, c)
		if slotOf(c) != slotOf(first) {
			second = c
		}
	}
	require.NotNil(t, second)

	save := func(conn *sql.Conn, typ string, amount int64) (*sql.Tx, error) {
		tx, err := conn.BeginTx(ctx, nil)
		require.NoError(t, err)
		if _, err := tx.ExecContext(ctx, `SET LOCAL lock_timeout = '1s'`); err != nil {
			return tx, err
		}
		txn := transaction.NewTransaction(newID(), "writer", "", typ, u.bankDOP, u.categoryID, money.FromInt(amount))
		txn.UserId = u.id
		txn.CreatedAt = time.Now()
		return tx, txRepo.Save(txhelper.WithTx(ctx, tx), txn)
	}
	open, err := save(first, "bill", 40)
	require.NoError(t, err)
	other, err := save(second, "income", 15)
	require.NoError(t, err, "the second writer waited for the first one's balance row")
	require.NoError(t, other.Commit())
	require.NoError(t, open.Commit())

	requireStoredMatchesLedger(t, db, u.id)
	b, err := accountRepo.NewAccountRepository(db).Balance(ctx, u.bankDOP, u.id)
	require.NoError(t, err)
	require.Truef(t, money.FromInt(-25).Equal(b), "balance %s", b)
}
