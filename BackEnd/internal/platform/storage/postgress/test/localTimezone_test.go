package postgress

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/segmentio/ksuid"
	"github.com/stretchr/testify/require"

	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money/moneytest"
	dto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/transaction"
	analyticsRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/analytics"
	transactionRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/transaction"
	analyticsService "github.com/osmait/gestorDePresupuesto/internal/services/analytics"
)

// Days and months are those of the app time zone (Santo Domingo, UTC-4):
// a bill paid on Oct 31 at 21:30 local (Nov 1 01:30 UTC) is an October bill,
// one paid on Sep 30 at 23:30 local (Oct 1 03:30 UTC) is a September bill.
// The October transaction list, the October analytics (rollup and ledger
// paths) and the October budget spending contain exactly the first.
func TestLocalTimezone_OctoberContainsTheLocalOctoberBills(t *testing.T) {
	t.Parallel()

	loc, err := time.LoadLocation("America/Santo_Domingo")
	require.NoError(t, err)
	db := SetUpTest()
	ctx := context.Background()

	userID, accountID, categoryID, budgetID := ksuid.New().String(), ksuid.New().String(), ksuid.New().String(), ksuid.New().String()
	lateOctober := time.Date(2026, 10, 31, 21, 30, 0, 0, loc)  // 2026-11-01T01:30Z
	lateSeptember := time.Date(2026, 9, 30, 23, 30, 0, 0, loc) // 2026-10-01T03:30Z
	octoberID, septemberID := ksuid.New().String(), ksuid.New().String()

	for _, stmt := range []struct {
		q    string
		args []any
	}{
		{`INSERT INTO users (id, name, last_name, email, password) VALUES ($1, 'T', 'Z', $2, 'x')`, []any{userID, userID + "@tz.test"}},
		{`INSERT INTO account (id, name_account, bank, user_id) VALUES ($1, 'a', 'b', $2)`, []any{accountID, userID}},
		{`INSERT INTO categorys (id, name, icon, color, user_id) VALUES ($1, 'c', 'i', '#000', $2)`, []any{categoryID, userID}},
		{`INSERT INTO budgets (id, category_id, amount, user_id) VALUES ($1, $2, 1000, $3)`, []any{budgetID, categoryID, userID}},
		{`INSERT INTO transactions (id, transaction_name, transaction_description, amount, type_transation, account_id, user_id, category_id, budget_id, currency, created_at)
			VALUES ($1, 'late october', '', 100, 'bill', $2, $3, $4, $5, 'DOP', $6), ($7, 'late september', '', 7, 'bill', $2, $3, $4, $5, 'DOP', $8)`,
			[]any{octoberID, accountID, userID, categoryID, budgetID, lateOctober, septemberID, lateSeptember}},
	} {
		_, err := db.ExecContext(ctx, stmt.q, stmt.args...)
		require.NoError(t, err)
	}

	t.Run("transaction list filtered to October", func(t *testing.T) {
		t.Parallel()
		gin.SetMode(gin.TestMode)
		for _, query := range []string{
			"date_from=2026-10-01&date_to=2026-10-31",
			"date_from=2026/10/01&date_to=2026/10/31",
		} {
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Request = httptest.NewRequest(http.MethodGet, "/transaction?"+query, nil)
			filter := dto.NewTransactionFilter()
			require.NoError(t, filter.ParseFromQuery(c, loc))
			require.NoError(t, filter.Validate())

			repo := transactionRepo.NewTransactionRepository(db)
			txs, err := repo.FindAllOfAllAccountsWithFilters(ctx, userID, filter)
			require.NoError(t, err)
			require.Len(t, txs, 1, query)
			require.Equal(t, octoberID, txs[0].Id, query)
			count, err := repo.CountWithFilters(ctx, userID, filter)
			require.NoError(t, err)
			require.EqualValues(t, 1, count, query)

			// and September's list has the other one (a new context: gin
			// caches the query of the first)
			sc, _ := gin.CreateTestContext(httptest.NewRecorder())
			sc.Request = httptest.NewRequest(http.MethodGet, "/transaction?date_from=2026-09-01&date_to=2026-09-30", nil)
			september := dto.NewTransactionFilter()
			require.NoError(t, september.ParseFromQuery(sc, loc))
			txs, err = repo.FindAllOfAllAccountsWithFilters(ctx, userID, september)
			require.NoError(t, err)
			require.Len(t, txs, 1)
			require.Equal(t, septemberID, txs[0].Id)
		}
	})

	t.Run("October analytics totals and monthly rollup", func(t *testing.T) {
		t.Parallel()
		rate := func(context.Context) (money.Amount, error) { return money.MustParse("58.5"), nil }
		repo := analyticsRepo.NewAnalyticsRepository(db, analyticsRepo.WithLocation(loc))
		service := analyticsService.NewAnalyticsService(repo, nil, nil, nil, rate, analyticsService.WithLocation(loc))

		october := analyticsService.DashboardFilters{
			DateFrom: time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC), // as the handler parses date_from
			DateTo:   time.Date(2026, 10, 31, 0, 0, 0, 0, time.UTC),
		}
		for name, filters := range map[string]analyticsService.DashboardFilters{
			"whole month (rollup)":       october,
			"account filter (ledger)":    {DateFrom: october.DateFrom, DateTo: october.DateTo, AccountID: accountID},
			"category filter (rollup)":   {DateFrom: october.DateFrom, DateTo: october.DateTo, CategoryID: categoryID},
			"local calendar day bounds":  {DateFrom: time.Date(2026, 10, 1, 0, 0, 0, 0, loc), DateTo: time.Date(2026, 10, 31, 23, 0, 0, 0, loc)},
			"single last day (ledger)":   {DateFrom: october.DateTo, DateTo: october.DateTo},
			"partial month then October": {DateFrom: time.Date(2026, 9, 30, 0, 0, 0, 0, time.UTC), DateTo: october.DateTo},
		} {
			summary, err := service.GetDashboardSummary(ctx, userID, filters)
			require.NoError(t, err, name)
			want := int64(100)
			wantMonthly := map[string]int64{"2026-10": 100}
			if name == "partial month then October" {
				want = 107
				wantMonthly = map[string]int64{"2026-09": 7, "2026-10": 100}
			}
			moneytest.Equal(t, want, summary.TotalExpenses, name)
			gotMonthly := map[string]int64{}
			for _, m := range summary.MonthlySummary {
				gotMonthly[m.Month] = m.Expenses.IntPart()
			}
			require.Equal(t, wantMonthly, gotMonthly, name)
			categoryTotal := money.Zero
			for _, c := range summary.CategoryExpenses {
				categoryTotal = categoryTotal.Add(c.Value)
			}
			moneytest.Equal(t, want, categoryTotal, name+": category expenses")
		}

		monthly, err := service.GetMonthlySummary(ctx, userID)
		require.NoError(t, err)
		gotMonthly := map[string]int64{}
		for _, m := range monthly {
			gotMonthly[m.Month] = m.Expenses.IntPart()
		}
		require.Equal(t, map[string]int64{"2026-09": 7, "2026-10": 100}, gotMonthly, "all-time monthly summary")

		var rollupOctober string
		require.NoError(t, db.QueryRowContext(ctx, `SELECT COALESCE(SUM(amount_sum), 0)::numeric(19,2)::text FROM transaction_monthly_rollup
			WHERE user_id = $1 AND month = '2026-10-01' AND type_transation = 'bill'`, userID).Scan(&rollupOctober))
		require.Equal(t, "100.00", rollupOctober)
	})

	t.Run("October budget spending", func(t *testing.T) {
		t.Parallel()
		rate := money.MustParse("58.5")
		for _, now := range []time.Time{
			time.Date(2026, 10, 15, 12, 0, 0, 0, loc),
			time.Date(2026, 10, 1, 0, 0, 0, 0, loc),
			time.Date(2026, 10, 31, 22, 0, 0, 0, loc), // already November in UTC
		} {
			repo := transactionRepo.NewTransactionRepository(db, transactionRepo.WithClock(func() time.Time { return now }))
			all, err := repo.FindCurrentSpentByCategory(ctx, userID, rate)
			require.NoError(t, err)
			moneytest.Equal(t, 100, all[categoryID], now.String())
			one, err := repo.FindCurrentCategorySpent(ctx, categoryID, userID, rate)
			require.NoError(t, err)
			moneytest.Equal(t, 100, one, now.String())
		}
		// in local September only the September bill counts
		repo := transactionRepo.NewTransactionRepository(db, transactionRepo.WithClock(func() time.Time { return time.Date(2026, 9, 30, 23, 59, 0, 0, loc) }))
		one, err := repo.FindCurrentCategorySpent(ctx, categoryID, userID, rate)
		require.NoError(t, err)
		moneytest.Equal(t, 7, one)
	})
}
