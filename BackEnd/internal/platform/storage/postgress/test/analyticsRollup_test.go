package postgress

import (
	"context"
	"database/sql"
	"fmt"
	"math/rand/v2"
	"os"
	"sort"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/lib/pq"
	"github.com/segmentio/ksuid"
	"github.com/stretchr/testify/require"

	"github.com/osmait/gestorDePresupuesto/internal/domain/analytics"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
	analyticsRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/analytics"
	"github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/txhelper"
	"github.com/osmait/gestorDePresupuesto/internal/platform/utils"
)

// ── The analytics queries as they were before the monthly rollup (000054) ──
// They aggregate the ledger directly and are the reference the rollup-based
// repository must reproduce exactly. Ranges are half-open: [$3, $4).

const legacyCategoryExpensesSQL = `
	SELECT c.id, c.name,
		COALESCE(SUM(CASE WHEN t.currency = 'USD' THEN t.amount * $2 ELSE t.amount END), 0) as total,
		c.color,
		COUNT(*) as transaction_count,
		COALESCE(SUM(CASE WHEN t.currency = 'DOP' THEN t.amount ELSE 0 END), 0) as dop_total,
		COALESCE(SUM(CASE WHEN t.currency = 'USD' THEN t.amount ELSE 0 END), 0) as usd_total
	FROM transactions t
	JOIN categorys c ON t.category_id = c.id
	WHERE t.user_id = $1 AND t.type_transation = 'bill'
	GROUP BY c.id, c.name, c.color`

const legacyMonthlySummarySQL = `
	SELECT
		EXTRACT(YEAR FROM created_at)::int as year,
		EXTRACT(MONTH FROM created_at)::int as month,
		COALESCE(SUM(CASE
			WHEN type_transation = 'income' AND currency = 'USD' THEN amount * $2
			WHEN type_transation = 'income' THEN amount
			ELSE 0
		END), 0) as total_income,
		COALESCE(SUM(CASE
			WHEN type_transation = 'bill' AND currency = 'USD' THEN amount * $2
			WHEN type_transation = 'bill' THEN amount
			ELSE 0
		END), 0) as total_bill
	FROM transactions
	WHERE user_id = $1
	GROUP BY year, month
	ORDER BY year, month`

const legacyCategoryExpensesInRangeSQL = `
	SELECT c.id, c.name,
		COALESCE(SUM(CASE WHEN t.currency = 'USD' THEN t.amount * $2 ELSE t.amount END), 0) as total,
		c.color,
		COUNT(*) as transaction_count,
		COALESCE(SUM(CASE WHEN t.currency = 'DOP' THEN t.amount ELSE 0 END), 0) as dop_total,
		COALESCE(SUM(CASE WHEN t.currency = 'USD' THEN t.amount ELSE 0 END), 0) as usd_total
	FROM transactions t
	JOIN categorys c ON t.category_id = c.id
	WHERE t.user_id = $1
		AND t.type_transation = 'bill'
		AND (NULLIF($5, '') IS NULL OR t.account_id::text = $5)
		AND (NULLIF($6, '') IS NULL OR t.category_id::text = $6)
		AND ($7 = '' OR $7 = 'bill')
		AND ($8::numeric IS NULL OR t.amount >= $8)
		AND ($9::numeric IS NULL OR t.amount <= $9)
		AND t.created_at >= $3 AND t.created_at < $4
	GROUP BY c.id, c.name, c.color`

const legacyMonthlySummaryInRangeSQL = `
	SELECT
		EXTRACT(YEAR FROM created_at)::int as year,
		EXTRACT(MONTH FROM created_at)::int as month,
		COALESCE(SUM(CASE
			WHEN type_transation = 'income' AND currency = 'USD' THEN amount * $2
			WHEN type_transation = 'income' THEN amount
			ELSE 0
		END), 0) as total_income,
		COALESCE(SUM(CASE
			WHEN type_transation = 'bill' AND currency = 'USD' THEN amount * $2
			WHEN type_transation = 'bill' THEN amount
			ELSE 0
		END), 0) as total_bill
	FROM transactions
	WHERE user_id = $1
		AND (NULLIF($5, '') IS NULL OR account_id::text = $5)
		AND (NULLIF($6, '') IS NULL OR category_id::text = $6)
		AND (NULLIF($7, '') IS NULL OR type_transation::text = $7)
		AND ($8::numeric IS NULL OR amount >= $8)
		AND ($9::numeric IS NULL OR amount <= $9)
		AND created_at >= $3 AND created_at < $4
	GROUP BY year, month
	ORDER BY year, month`

const legacyTotalsInRangeSQL = `
	SELECT
		COALESCE(SUM(CASE
			WHEN type_transation = 'income' AND currency = 'USD' THEN amount * $2
			WHEN type_transation = 'income' THEN amount
			ELSE 0
		END), 0) as total_income,
		COALESCE(SUM(CASE
			WHEN type_transation = 'bill' AND currency = 'USD' THEN amount * $2
			WHEN type_transation = 'bill' THEN amount
			ELSE 0
		END), 0) as total_bill
	FROM transactions
	WHERE user_id = $1
		AND (NULLIF($5, '') IS NULL OR account_id::text = $5)
		AND (NULLIF($6, '') IS NULL OR category_id::text = $6)
		AND (NULLIF($7, '') IS NULL OR type_transation::text = $7)
		AND ($8::numeric IS NULL OR amount >= $8)
		AND ($9::numeric IS NULL OR amount <= $9)
		AND created_at >= $3 AND created_at < $4`

func legacyCategoryExpenses(ctx context.Context, q txhelper.Querier, query string, args ...any) ([]*analytics.CategoryExpenseRepository, error) {
	rows, err := q.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()
	var out []*analytics.CategoryExpenseRepository
	for rows.Next() {
		var r analytics.CategoryExpenseRepository
		if err := rows.Scan(&r.CategoryID, &r.CategoryName, &r.TotalAmount, &r.CategoryColor, &r.TransactionCount, &r.DopTotal, &r.UsdTotal); err != nil {
			return nil, err
		}
		out = append(out, &r)
	}
	return out, rows.Err()
}

func legacyMonthlySummary(ctx context.Context, q txhelper.Querier, query string, args ...any) ([]*analytics.MonthlySummaryRepository, error) {
	rows, err := q.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()
	var out []*analytics.MonthlySummaryRepository
	for rows.Next() {
		var r analytics.MonthlySummaryRepository
		var month int
		if err := rows.Scan(&r.Year, &month, &r.TotalIncome, &r.TotalBill); err != nil {
			return nil, err
		}
		r.Month = time.Month(month)
		out = append(out, &r)
	}
	return out, rows.Err()
}

// ── A database owned by a role WITHOUT BYPASSRLS ────────────────────────────
// Migrations run as that role (like the perf setup and any deployment whose
// app role owns the tables), so FORCE ROW LEVEL SECURITY applies to the
// rollup triggers, the migration backfill and every query below.

var (
	rlsDBOnce sync.Once
	rlsDB     *sql.DB
	rlsDBErr  error
)

func rollupRLSDB(t *testing.T) *sql.DB {
	t.Helper()
	rlsDBOnce.Do(func() {
		admin := SetUpTest()
		for _, stmt := range []string{
			"CREATE ROLE rollup_owner LOGIN PASSWORD 'rollup' NOSUPERUSER NOBYPASSRLS",
			"CREATE DATABASE rollup_rls OWNER rollup_owner",
		} {
			if _, rlsDBErr = admin.Exec(stmt); rlsDBErr != nil {
				return
			}
		}
		dsn := fmt.Sprintf("postgres://rollup_owner:rollup@%s/rollup_rls?sslmode=disable&binary_parameters=yes", testServerAddr)
		if rlsDBErr = utils.RunDBMigration(testMigrationsURL, dsn); rlsDBErr != nil {
			return
		}
		rlsDB, rlsDBErr = sql.Open("postgres", dsn)
	})
	require.NoError(t, rlsDBErr)
	return rlsDB
}

// inRLSTx runs fn in a transaction with the settings RLSMiddleware sets.
func inRLSTx(ctx context.Context, db *sql.DB, userID string, admin bool, fn func(ctx context.Context, tx *sql.Tx) error) error {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()
	if _, err := tx.ExecContext(ctx, `SELECT set_config('app.current_user_id', $1, true), set_config('app.is_admin', $2, true)`,
		userID, strconv.FormatBool(admin)); err != nil {
		return err
	}
	if err := fn(txhelper.WithTx(ctx, tx), tx); err != nil {
		return err
	}
	return tx.Commit()
}

type rollupFixtureUser struct {
	id         string
	accounts   []string
	categories []string
	live       map[string]bool // ids of the user's transactions
}

func (u *rollupFixtureUser) liveIDs() []string {
	ids := make([]string, 0, len(u.live))
	for id := range u.live {
		ids = append(ids, id)
	}
	sort.Strings(ids)
	return ids
}

type rollupGen struct {
	rng *rand.Rand
}

var rollupTypes = []string{"bill", "bill", "bill", "income", "income", "card_payment", "loan_collection", "investment_purchase", "loan_cancellation_refund"}

func (g rollupGen) instant() time.Time {
	base := time.Date(2023, time.January, 1, 0, 0, 0, 0, time.UTC)
	switch g.rng.IntN(3) {
	case 0:
		// on/around a UTC month boundary, and around Santo Domingo's (04:00 UTC)
		m := base.AddDate(0, g.rng.IntN(48), 0)
		deltas := []time.Duration{0, time.Microsecond, -time.Microsecond, time.Second, -time.Second, 4 * time.Hour, 4*time.Hour - time.Microsecond}
		return m.Add(deltas[g.rng.IntN(len(deltas))])
	default:
		span := time.Date(2027, time.January, 1, 0, 0, 0, 0, time.UTC).Sub(base)
		return base.Add(time.Duration(g.rng.Int64N(int64(span/time.Microsecond))) * time.Microsecond)
	}
}

func (g rollupGen) amount() money.Amount {
	if g.rng.IntN(20) == 0 {
		return money.Zero
	}
	return money.New(g.rng.Int64N(1_000_000_000)+1, -4) // 0.0001 .. 100000.0000
}

func (g rollupGen) currency() any {
	switch n := g.rng.IntN(20); {
	case n < 10:
		return "DOP"
	case n < 17:
		return "USD"
	case n < 19:
		return nil
	default:
		return "EUR"
	}
}

func (g rollupGen) pick(xs []string) string { return xs[g.rng.IntN(len(xs))] }

// insertBatch inserts n random transactions of u in ONE statement.
func (g rollupGen) insertBatch(ctx context.Context, tx *sql.Tx, u *rollupFixtureUser, n int) error {
	var sb strings.Builder
	sb.WriteString(`INSERT INTO transactions (id, transaction_name, transaction_description, amount, type_transation, account_id, user_id, category_id, currency, created_at) VALUES `)
	args := make([]any, 0, n*10)
	ids := make([]string, 0, n)
	for i := 0; i < n; i++ {
		if i > 0 {
			sb.WriteString(", ")
		}
		p := len(args)
		fmt.Fprintf(&sb, "($%d,$%d,$%d,$%d,$%d,$%d,$%d,$%d,$%d,$%d)", p+1, p+2, p+3, p+4, p+5, p+6, p+7, p+8, p+9, p+10)
		id := ksuid.New().String()
		ids = append(ids, id)
		args = append(args, id, "tx", "", g.amount(), g.pick(rollupTypes), g.pick(u.accounts), u.id, g.pick(u.categories), g.currency(), g.instant())
	}
	if _, err := tx.ExecContext(ctx, sb.String(), args...); err != nil {
		return err
	}
	for _, id := range ids {
		u.live[id] = true
	}
	return nil
}

// mutate applies one random UPDATE/DELETE statement to u's transactions.
func (g rollupGen) mutate(ctx context.Context, tx *sql.Tx, u *rollupFixtureUser) error {
	ids := u.liveIDs()
	if len(ids) == 0 {
		return nil
	}
	some := func(max int) []string {
		n := 1 + g.rng.IntN(max)
		out := make([]string, 0, n)
		for i := 0; i < n; i++ {
			out = append(out, g.pick(ids))
		}
		return out
	}
	var err error
	switch g.rng.IntN(8) {
	case 0: // one row: every rollup key column and the amount, each kept or changed
		keep := func() bool { return g.rng.IntN(2) == 0 }
		set := []string{}
		args := []any{g.pick(ids)}
		add := func(col string, v any) {
			args = append(args, v)
			set = append(set, fmt.Sprintf("%s = $%d", col, len(args)))
		}
		if !keep() {
			add("created_at", g.instant())
		}
		if !keep() {
			add("category_id", g.pick(u.categories))
		}
		if !keep() {
			add("type_transation", g.pick(rollupTypes))
		}
		if !keep() {
			add("currency", g.currency())
		}
		if !keep() {
			add("amount", g.amount())
		}
		if len(set) == 0 {
			set = append(set, "transaction_name = transaction_name || 'x'")
		}
		_, err = tx.ExecContext(ctx, "UPDATE transactions SET "+strings.Join(set, ", ")+" WHERE id = $1", args...)
	case 1: // many rows move by some days (some cross a month boundary)
		_, err = tx.ExecContext(ctx, `UPDATE transactions SET created_at = created_at + make_interval(days => $2) WHERE id = ANY($1)`,
			pq.Array(some(40)), g.rng.IntN(61)-30)
	case 2: // many rows change amount
		_, err = tx.ExecContext(ctx, `UPDATE transactions SET amount = amount + $2 WHERE id = ANY($1)`, pq.Array(some(40)), g.amount())
	case 3: // many rows change category / type / currency
		_, err = tx.ExecContext(ctx, `UPDATE transactions SET category_id = $2, type_transation = $3, currency = $4 WHERE id = ANY($1)`,
			pq.Array(some(20)), g.pick(u.categories), g.pick(rollupTypes), g.currency())
	case 4: // no rollup column changes
		_, err = tx.ExecContext(ctx, `UPDATE transactions SET transaction_name = transaction_name || 'y' WHERE id = ANY($1)`, pq.Array(some(20)))
	case 5: // delete one
		id := g.pick(ids)
		_, err = tx.ExecContext(ctx, `DELETE FROM transactions WHERE id = $1`, id)
		delete(u.live, id)
	case 6: // delete many
		del := some(15)
		_, err = tx.ExecContext(ctx, `DELETE FROM transactions WHERE id = ANY($1)`, pq.Array(del))
		for _, id := range del {
			delete(u.live, id)
		}
	case 7:
		err = g.insertBatch(ctx, tx, u, 1+g.rng.IntN(5))
	}
	return err
}

// randomRange returns a dashboard-like [from, to) range.
func (g rollupGen) randomRange() (time.Time, time.Time) {
	from := g.instant()
	var to time.Time
	switch g.rng.IntN(5) {
	case 0: // inside one month
		to = from.Add(time.Duration(g.rng.Int64N(int64(20 * 24 * time.Hour))))
	case 1: // whole UTC months exactly, as dashboardDateRange builds them
		f := from.UTC()
		from = time.Date(f.Year(), f.Month(), 1, 0, 0, 0, 0, time.UTC)
		to = from.AddDate(0, 1+g.rng.IntN(14), 0)
	case 2: // Santo Domingo calendar dates, as currentYearRangeInSantoDomingo builds them
		loc, _ := time.LoadLocation("America/Santo_Domingo")
		f := from.In(loc)
		from = time.Date(f.Year(), time.January, 1, 0, 0, 0, 0, loc)
		to = from.AddDate(0, g.rng.IntN(13), g.rng.IntN(28))
	case 3: // reversed: the ledger returns nothing
		to = from.Add(-time.Duration(g.rng.Int64N(int64(400 * 24 * time.Hour))))
	default:
		to = from.Add(time.Duration(g.rng.Int64N(int64(3 * 365 * 24 * time.Hour))))
	}
	return from, to
}

func requireSameCategoryExpenses(t *testing.T, want, got []*analytics.CategoryExpenseRepository, what string) {
	t.Helper()
	require.Equal(t, len(want), len(got), "%s: number of categories", what)
	byID := map[string]*analytics.CategoryExpenseRepository{}
	for _, g := range got {
		byID[g.CategoryID] = g
	}
	for _, w := range want {
		g := byID[w.CategoryID]
		require.NotNil(t, g, "%s: category %s missing", what, w.CategoryID)
		require.Equal(t, w.CategoryName, g.CategoryName, what)
		require.Equal(t, w.CategoryColor, g.CategoryColor, what)
		require.Equal(t, w.TransactionCount, g.TransactionCount, "%s: count of %s", what, w.CategoryID)
		require.True(t, w.TotalAmount.Equal(g.TotalAmount), "%s: total of %s: want %s got %s", what, w.CategoryID, w.TotalAmount, g.TotalAmount)
		require.True(t, w.DopTotal.Equal(g.DopTotal), "%s: dop of %s: want %s got %s", what, w.CategoryID, w.DopTotal, g.DopTotal)
		require.True(t, w.UsdTotal.Equal(g.UsdTotal), "%s: usd of %s: want %s got %s", what, w.CategoryID, w.UsdTotal, g.UsdTotal)
	}
}

func requireSameMonthly(t *testing.T, want, got []*analytics.MonthlySummaryRepository, what string) {
	t.Helper()
	require.Equal(t, len(want), len(got), "%s: number of months", what)
	for i := range want {
		w, g := want[i], got[i]
		require.Equal(t, w.Year, g.Year, what)
		require.Equal(t, w.Month, g.Month, what)
		require.True(t, w.TotalIncome.Equal(g.TotalIncome), "%s %d-%02d income: want %s got %s", what, w.Year, w.Month, w.TotalIncome, g.TotalIncome)
		require.True(t, w.TotalBill.Equal(g.TotalBill), "%s %d-%02d bill: want %s got %s", what, w.Year, w.Month, w.TotalBill, g.TotalBill)
	}
}

// rollupReads counts the scans of transaction_monthly_rollup by this backend
// that are not yet flushed to the cumulative statistics (they include the
// current transaction's): compare two readings in one transaction.
func rollupReads(ctx context.Context, tx *sql.Tx) (int64, error) {
	var n int64
	err := tx.QueryRowContext(ctx, `SELECT COALESCE(SUM(seq_scan + COALESCE(idx_scan, 0)), 0)::bigint
		FROM pg_stat_xact_user_tables WHERE relname = 'transaction_monthly_rollup'`).Scan(&n)
	return n, err
}

// requireRollupMatchesLedger checks the rollup table row by row against the
// ledger it summarises.
func requireRollupMatchesLedger(t *testing.T, ctx context.Context, db *sql.DB) {
	t.Helper()
	require.NoError(t, inRLSTx(ctx, db, "", true, func(ctx context.Context, tx *sql.Tx) error {
		var diff, negative int
		if err := tx.QueryRowContext(ctx, `
			WITH expect AS (
				SELECT user_id, (date_trunc('month', created_at AT TIME ZONE 'UTC'))::date AS month, category_id,
					type_transation, COALESCE(currency, '') AS currency, SUM(amount) AS s, COUNT(*) AS c
				FROM transactions GROUP BY 1, 2, 3, 4, 5),
			got AS (
				SELECT user_id, month, category_id, type_transation, currency, amount_sum, tx_count FROM transaction_monthly_rollup)
			SELECT (SELECT count(*) FROM ((SELECT * FROM expect EXCEPT SELECT * FROM got) UNION ALL (SELECT * FROM got EXCEPT SELECT * FROM expect)) d),
				(SELECT count(*) FROM transaction_monthly_rollup WHERE tx_count <= 0)`).Scan(&diff, &negative); err != nil {
			return err
		}
		require.Zero(t, diff, "rollup rows differing from the ledger")
		require.Zero(t, negative, "rollup rows with a non-positive count")
		return nil
	}))
}

// TestAnalyticsRollup_RandomizedEquivalence writes random transactions
// (batched inserts, single and bulk updates of every rollup key column and
// the amount, deletes, a rolled-back transaction) through FORCE RLS with a
// role that cannot bypass it, and checks after every phase that
//   - the rollup equals the ledger aggregate, and
//   - every analytics method of the repository (rollup + ledger edges) returns
//     exactly what the pre-rollup queries return, for random rates, date
//     ranges and filters.
//
// ROLLUP_EQUIV_SEED reproduces a run.
func TestAnalyticsRollup_RandomizedEquivalence(t *testing.T) {
	db := rollupRLSDB(t)
	ctx := context.Background()

	seed := uint64(time.Now().UnixNano())
	if s := os.Getenv("ROLLUP_EQUIV_SEED"); s != "" {
		v, err := strconv.ParseUint(s, 10, 64)
		require.NoError(t, err)
		seed = v
	}
	t.Logf("ROLLUP_EQUIV_SEED=%d", seed)
	g := rollupGen{rng: rand.New(rand.NewPCG(seed, seed^0x9e3779b97f4a7c15))}

	var rolBypass, rolSuper bool
	require.NoError(t, db.QueryRow(`SELECT rolbypassrls, rolsuper FROM pg_roles WHERE rolname = current_user`).Scan(&rolBypass, &rolSuper))
	require.False(t, rolBypass || rolSuper, "the test role must be subject to RLS")

	// fixtures (admin context)
	users := make([]*rollupFixtureUser, 3)
	require.NoError(t, inRLSTx(ctx, db, "", true, func(ctx context.Context, tx *sql.Tx) error {
		for i := range users {
			u := &rollupFixtureUser{id: ksuid.New().String(), live: map[string]bool{}}
			if _, err := tx.ExecContext(ctx, `INSERT INTO users (id, name, last_name, email, password) VALUES ($1, 'R', 'U', $2, 'x')`,
				u.id, u.id+"@rollup.test"); err != nil {
				return err
			}
			for a := 0; a < 2; a++ {
				id := ksuid.New().String()[:27]
				if _, err := tx.ExecContext(ctx, `INSERT INTO account (id, name_account, bank, user_id) VALUES ($1, 'acc', 'bank', $2)`, id, u.id); err != nil {
					return err
				}
				u.accounts = append(u.accounts, id)
			}
			for c := 0; c < 6; c++ {
				id := ksuid.New().String()
				if _, err := tx.ExecContext(ctx, `INSERT INTO categorys (id, name, icon, color, user_id) VALUES ($1, $2, 'i', $3, $4)`,
					id, fmt.Sprintf("cat%d", c), fmt.Sprintf("#%06d", c), u.id); err != nil {
					return err
				}
				u.categories = append(u.categories, id)
			}
			users[i] = u
		}
		return nil
	}))

	rates := []money.Amount{money.FromInt(1), money.MustParse("58.7512"), money.MustParse("0.000123")}
	repo := analyticsRepo.NewAnalyticsRepository(db)
	compare := func(phase string) {
		requireRollupMatchesLedger(t, ctx, db)
		var rangesViaRollup int
		for ui, u := range users {
			require.NoError(t, inRLSTx(ctx, db, u.id, false, func(ctx context.Context, tx *sql.Tx) error {
				before, err := rollupReads(ctx, tx)
				if err != nil {
					return err
				}
				for _, rate := range rates {
					what := fmt.Sprintf("%s user%d rate %s", phase, ui, rate)

					want, err := legacyCategoryExpenses(ctx, tx, legacyCategoryExpensesSQL, u.id, rate)
					require.NoError(t, err)
					got, err := repo.GetCategoryExpenses(ctx, u.id, rate)
					require.NoError(t, err)
					requireSameCategoryExpenses(t, want, got, what+" all-time categories")

					wantM, err := legacyMonthlySummary(ctx, tx, legacyMonthlySummarySQL, u.id, rate)
					require.NoError(t, err)
					gotM, err := repo.GetMonthlySummary(ctx, u.id, rate)
					require.NoError(t, err)
					requireSameMonthly(t, wantM, gotM, what+" all-time monthly")

					for r := 0; r < 12; r++ {
						from, to := g.randomRange()
						category := ""
						if g.rng.IntN(3) == 0 {
							category = g.pick(u.categories)
						}
						txType := []string{"", "", "bill", "income"}[g.rng.IntN(4)]
						rwhat := fmt.Sprintf("%s range [%s, %s) cat=%q type=%q", what, from.Format(time.RFC3339Nano), to.Format(time.RFC3339Nano), category, txType)
						if !to.Before(from) && to.Sub(from) > 62*24*time.Hour {
							rangesViaRollup++
						}
						args := []any{u.id, rate, from, to, "", category, txType, nil, nil}

						wantC, err := legacyCategoryExpenses(ctx, tx, legacyCategoryExpensesInRangeSQL, args...)
						require.NoError(t, err)
						gotC, err := repo.GetCategoryExpensesInRange(ctx, u.id, rate, from, to, "", category, txType, nil, nil)
						require.NoError(t, err)
						requireSameCategoryExpenses(t, wantC, gotC, rwhat+" categories")

						wantR, err := legacyMonthlySummary(ctx, tx, legacyMonthlySummaryInRangeSQL, args...)
						require.NoError(t, err)
						gotR, err := repo.GetMonthlySummaryInRange(ctx, u.id, rate, from, to, "", category, txType, nil, nil)
						require.NoError(t, err)
						requireSameMonthly(t, wantR, gotR, rwhat+" monthly")

						var wantT analytics.TotalsRepository
						require.NoError(t, tx.QueryRowContext(ctx, legacyTotalsInRangeSQL, args...).Scan(&wantT.TotalIncome, &wantT.TotalBill))
						gotT, err := repo.GetTotalsInRange(ctx, u.id, rate, from, to, "", category, txType, nil, nil)
						require.NoError(t, err)
						require.True(t, wantT.TotalIncome.Equal(gotT.TotalIncome), "%s totals income: want %s got %s", rwhat, wantT.TotalIncome, gotT.TotalIncome)
						require.True(t, wantT.TotalBill.Equal(gotT.TotalBill), "%s totals bill: want %s got %s", rwhat, wantT.TotalBill, gotT.TotalBill)
					}
				}
				after, err := rollupReads(ctx, tx)
				if err != nil {
					return err
				}
				require.Greater(t, after, before, "%s user%d: the rollup was never read", phase, ui)
				return nil
			}))
		}
		require.Greater(t, rangesViaRollup, 10, "too few multi-month ranges")
	}

	// phase 1: batched inserts (user 3 stays empty)
	for i, n := range []int{900, 300} {
		u := users[i]
		require.NoError(t, inRLSTx(ctx, db, u.id, false, func(ctx context.Context, tx *sql.Tx) error {
			for left := n; left > 0; {
				b := min(left, 1+g.rng.IntN(60))
				if err := g.insertBatch(ctx, tx, u, b); err != nil {
					return err
				}
				left -= b
			}
			return nil
		}))
	}
	compare("after inserts")

	// phase 2: random updates / deletes, several statements per transaction
	for step := 0; step < 120; step++ {
		u := users[g.rng.IntN(2)]
		require.NoError(t, inRLSTx(ctx, db, u.id, false, func(ctx context.Context, tx *sql.Tx) error {
			for k := 1 + g.rng.IntN(3); k > 0; k-- {
				if err := g.mutate(ctx, tx, u); err != nil {
					return err
				}
			}
			return nil
		}), "step %d", step)
	}
	// a rolled-back transaction leaves no trace in the rollup
	u0 := users[0]
	snapshot := map[string]bool{}
	for id := range u0.live {
		snapshot[id] = true
	}
	errRollback := fmt.Errorf("rollback")
	require.ErrorIs(t, inRLSTx(ctx, db, u0.id, false, func(ctx context.Context, tx *sql.Tx) error {
		for k := 0; k < 5; k++ {
			if err := g.mutate(ctx, tx, u0); err != nil {
				return err
			}
		}
		return errRollback
	}), errRollback)
	u0.live = snapshot
	compare("after updates and deletes")

	// phase 3: delete everything of user 2 (rollup rows go away)
	require.NoError(t, inRLSTx(ctx, db, users[1].id, false, func(ctx context.Context, tx *sql.Tx) error {
		_, err := tx.ExecContext(ctx, `DELETE FROM transactions WHERE user_id = $1`, users[1].id)
		return err
	}))
	users[1].live = map[string]bool{}
	require.NoError(t, inRLSTx(ctx, db, "", true, func(ctx context.Context, tx *sql.Tx) error {
		var n int
		require.NoError(t, tx.QueryRowContext(ctx, `SELECT count(*) FROM transaction_monthly_rollup WHERE user_id = $1`, users[1].id).Scan(&n))
		require.Zero(t, n)
		return nil
	}))
	compare("after deleting a user's ledger")

	t.Run("isolation", func(t *testing.T) {
		a, b := users[0], users[1]
		require.NoError(t, inRLSTx(ctx, db, b.id, false, func(ctx context.Context, tx *sql.Tx) error {
			return g.insertBatch(ctx, tx, b, 5)
		}))
		require.NoError(t, inRLSTx(ctx, db, a.id, false, func(ctx context.Context, tx *sql.Tx) error {
			var mine, others int
			require.NoError(t, tx.QueryRowContext(ctx, `SELECT count(*) FILTER (WHERE user_id = $1), count(*) FILTER (WHERE user_id <> $1) FROM transaction_monthly_rollup`, a.id).Scan(&mine, &others))
			require.Positive(t, mine)
			require.Zero(t, others, "another user's rollup rows are visible")
			return nil
		}))
		// writing another user's rollup row, directly or through a transaction, is rejected
		err := inRLSTx(ctx, db, a.id, false, func(ctx context.Context, tx *sql.Tx) error {
			_, err := tx.ExecContext(ctx, `INSERT INTO transaction_monthly_rollup VALUES ($1, '2024-01-01', $2, 'bill', 'DOP', 1, 1)`, b.id, b.categories[0])
			return err
		})
		require.ErrorContains(t, err, "row-level security")
		err = inRLSTx(ctx, db, a.id, false, func(ctx context.Context, tx *sql.Tx) error {
			return g.insertBatch(ctx, tx, b, 1)
		})
		require.ErrorContains(t, err, "row-level security")
		// without the settings nothing is visible (FORCE RLS applies to the owner)
		tx, err := db.BeginTx(ctx, nil)
		require.NoError(t, err)
		defer func() { _ = tx.Rollback() }()
		var n int
		require.NoError(t, tx.QueryRowContext(ctx, `SELECT count(*) FROM transaction_monthly_rollup`).Scan(&n))
		require.Zero(t, n)
	})

	t.Run("non-UTC session falls back to the ledger", func(t *testing.T) {
		u := users[0]
		fresh := analyticsRepo.NewAnalyticsRepository(db) // the time-zone check is cached per repository
		require.NoError(t, inRLSTx(ctx, db, u.id, false, func(ctx context.Context, tx *sql.Tx) error {
			if _, err := tx.ExecContext(ctx, `SET LOCAL TimeZone = 'America/Santo_Domingo'`); err != nil {
				return err
			}
			before, err := rollupReads(ctx, tx)
			require.NoError(t, err)
			rate := rates[1]
			want, err := legacyMonthlySummary(ctx, tx, legacyMonthlySummarySQL, u.id, rate)
			require.NoError(t, err)
			got, err := fresh.GetMonthlySummary(ctx, u.id, rate)
			require.NoError(t, err)
			requireSameMonthly(t, want, got, "Santo Domingo session")
			wantC, err := legacyCategoryExpenses(ctx, tx, legacyCategoryExpensesSQL, u.id, rate)
			require.NoError(t, err)
			gotC, err := fresh.GetCategoryExpenses(ctx, u.id, rate)
			require.NoError(t, err)
			requireSameCategoryExpenses(t, wantC, gotC, "Santo Domingo session")
			from, to := time.Date(2024, 1, 1, 4, 0, 0, 0, time.UTC), time.Date(2025, 6, 1, 4, 0, 0, 0, time.UTC)
			wantR, err := legacyMonthlySummary(ctx, tx, legacyMonthlySummaryInRangeSQL, u.id, rate, from, to, "", "", "", nil, nil)
			require.NoError(t, err)
			gotR, err := fresh.GetMonthlySummaryInRange(ctx, u.id, rate, from, to, "", "", "", nil, nil)
			require.NoError(t, err)
			requireSameMonthly(t, wantR, gotR, "Santo Domingo session range")
			after, err := rollupReads(ctx, tx)
			require.NoError(t, err)
			require.Equal(t, before, after, "the rollup must not be read when months are not bucketed in UTC")
			return nil
		}))
	})
}
