package postgress

import (
	"context"
	"database/sql"
	"testing"
	"time"

	"github.com/segmentio/ksuid"
	"github.com/stretchr/testify/require"

	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
	transactionRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/transaction"
)

// The budget "spent this month" queries use a range predicate on created_at
// instead of date_trunc('month', created_at) = date_trunc('month',
// CURRENT_DATE). Both must select exactly the same rows in every session time
// zone, including instants a microsecond around the local month boundaries.
func TestFindCurrentBudgets_RangePredicateMatchesDateTrunc(t *testing.T) {
	db := rollupRLSDB(t)
	ctx := context.Background()
	repo := transactionRepo.NewTransactionRepository(db)

	userID, account, category, budget := ksuid.New().String(), ksuid.New().String(), ksuid.New().String(), ksuid.New().String()
	zones := []string{"UTC", "America/Santo_Domingo", "Pacific/Kiritimati", "Pacific/Pago_Pago", "Asia/Kolkata"}
	now := time.Now()

	require.NoError(t, inRLSTx(ctx, db, userID, false, func(ctx context.Context, tx *sql.Tx) error {
		for _, stmt := range []struct {
			q    string
			args []any
		}{
			{`SELECT set_config('app.is_admin', 'true', true)`, nil},
			{`INSERT INTO users (id, name, last_name, email, password) VALUES ($1, 'B', 'U', $2, 'x')`, []any{userID, userID + "@budget.test"}},
			{`INSERT INTO account (id, name_account, bank, user_id) VALUES ($1, 'a', 'b', $2)`, []any{account, userID}},
			{`INSERT INTO categorys (id, name, icon, color, user_id) VALUES ($1, 'c', 'i', '#000', $2)`, []any{category, userID}},
			{`INSERT INTO budgets (id, category_id, amount, user_id) VALUES ($1, $2, 100, $3)`, []any{budget, category, userID}},
		} {
			if _, err := tx.ExecContext(ctx, stmt.q, stmt.args...); err != nil {
				return err
			}
		}
		// rows around this month's and next month's start in every zone
		amount := int64(1)
		for _, zone := range zones {
			loc, err := time.LoadLocation(zone)
			require.NoError(t, err)
			local := now.In(loc)
			for _, m := range []time.Time{
				time.Date(local.Year(), local.Month(), 1, 0, 0, 0, 0, loc),
				time.Date(local.Year(), local.Month()+1, 1, 0, 0, 0, 0, loc),
			} {
				for _, d := range []time.Duration{-time.Microsecond, 0, time.Microsecond, time.Hour} {
					amount *= 2
					if amount > 1<<40 {
						amount = 3
					}
					if _, err := tx.ExecContext(ctx, `INSERT INTO transactions (id, transaction_name, amount, type_transation, account_id, user_id, category_id, budget_id, currency, created_at)
						VALUES ($1, 'b', $2, 'bill', $3, $4, $5, $6, $7, $8)`,
						ksuid.New().String(), money.FromInt(amount), account, userID, category, budget, []string{"DOP", "USD"}[amount%2], m.Add(d)); err != nil {
						return err
					}
				}
			}
		}
		return nil
	}))

	rate := money.MustParse("58.25")
	for _, zone := range zones {
		require.NoError(t, inRLSTx(ctx, db, userID, false, func(ctx context.Context, tx *sql.Tx) error {
			if _, err := tx.ExecContext(ctx, `SELECT set_config('TimeZone', $1, true)`, zone); err != nil {
				return err
			}
			var want money.Amount
			require.NoError(t, tx.QueryRowContext(ctx, `SELECT COALESCE(SUM(CASE WHEN currency = 'USD' THEN amount * $2 ELSE amount END), 0)
				FROM transactions WHERE user_id = $1 AND budget_id IS NOT NULL AND type_transation = 'bill'
				AND date_trunc('month', created_at) = date_trunc('month', CURRENT_DATE)`, userID, rate).Scan(&want))
			require.True(t, want.IsPositive(), zone)

			got, err := repo.FindCurrentBudgets(ctx, userID, rate)
			require.NoError(t, err)
			require.True(t, want.Equal(got[budget]), "%s: FindCurrentBudgets want %s got %s", zone, want, got[budget])

			one, err := repo.FindCurrentBudget(ctx, budget, userID, rate)
			require.NoError(t, err)
			require.True(t, want.Equal(one), "%s: FindCurrentBudget want %s got %s", zone, want, one)
			return nil
		}))
	}
}
