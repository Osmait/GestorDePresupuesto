package postgress

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/segmentio/ksuid"
	"github.com/stretchr/testify/require"

	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money/moneytest"
	analyticsdto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/analytics"
	analyticsHandler "github.com/osmait/gestorDePresupuesto/internal/platform/server/handler/analytics"
	analyticsRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/analytics"
	analyticsService "github.com/osmait/gestorDePresupuesto/internal/services/analytics"
)

type analyticsFixtureTx struct {
	amount   int64
	typ      string
	currency string
	at       time.Time
}

// seedAnalyticsUser inserts a user with one account and one category and the
// given transactions; it returns the user and account ids.
func seedAnalyticsUser(t *testing.T, db *sql.DB, txs []analyticsFixtureTx) (string, string) {
	t.Helper()
	userID, accountID, categoryID := ksuid.New().String(), ksuid.New().String(), ksuid.New().String()
	_, err := db.Exec(`INSERT INTO users (id, name, last_name, email, password) VALUES ($1, 'A', 'U', $2, 'x')`, userID, userID+"@analytics.test")
	require.NoError(t, err)
	_, err = db.Exec(`INSERT INTO account (id, name_account, bank, user_id) VALUES ($1, 'a', 'b', $2)`, accountID, userID)
	require.NoError(t, err)
	_, err = db.Exec(`INSERT INTO categorys (id, name, icon, color, user_id) VALUES ($1, 'c', 'i', '#000', $2)`, categoryID, userID)
	require.NoError(t, err)
	for _, tx := range txs {
		_, err = db.Exec(`INSERT INTO transactions (id, transaction_name, amount, type_transation, account_id, user_id, category_id, currency, created_at)
			VALUES ($1, 't', $2, $3, $4, $5, $6, $7, $8)`,
			ksuid.New().String(), money.FromInt(tx.amount), tx.typ, accountID, userID, categoryID, tx.currency, tx.at)
		require.NoError(t, err)
	}
	return userID, accountID
}

// GET /analytics/dashboard-summary treats date_from/date_to as inclusive
// calendar days of the app time zone (Santo Domingo, UTC-4): [date_from 00:00
// local, date_to + 1 day 00:00 local), the local days the transaction list
// filters on. An instant late in the local evening (already the next day in
// UTC) stays on its local day. Ranges served from the monthly rollup (whole
// local months) and from the ledger (account filter, partial months) agree.
func TestDashboardSummary_DateToIncludesTheWholeLastDay(t *testing.T) {
	t.Parallel()

	santoDomingo, err := time.LoadLocation("America/Santo_Domingo")
	require.NoError(t, err)
	db := SetUpTest()

	// Bill amounts are powers of two, so a total names the rows it contains.
	userID, accountID := seedAnalyticsUser(t, db, []analyticsFixtureTx{
		{1, "bill", "DOP", time.Date(2024, 12, 31, 23, 59, 59, 999999000, santoDomingo)}, // Jan 1 03:59 UTC
		{2, "bill", "DOP", time.Date(2025, 1, 1, 0, 0, 0, 0, santoDomingo)},
		{4, "bill", "DOP", time.Date(2025, 1, 31, 18, 0, 0, 0, santoDomingo)},           // 22:00 UTC
		{8, "bill", "DOP", time.Date(2025, 1, 31, 23, 59, 59, 999999000, santoDomingo)}, // Feb 1 03:59 UTC
		{16, "bill", "DOP", time.Date(2025, 2, 1, 0, 0, 0, 0, santoDomingo)},            // 04:00 UTC
		{32, "bill", "DOP", time.Date(2025, 2, 1, 0, 0, 0, 0, time.UTC)},                // Jan 31 20:00 local
		{64, "bill", "DOP", time.Date(2025, 2, 28, 12, 0, 0, 0, santoDomingo)},
		{128, "bill", "DOP", time.Date(2025, 3, 1, 0, 0, 0, 0, santoDomingo)},
		{1000, "income", "DOP", time.Date(2025, 1, 31, 18, 0, 0, 0, santoDomingo)},
	})

	gin.SetMode(gin.TestMode)
	service := analyticsService.NewAnalyticsService(analyticsRepo.NewAnalyticsRepository(db), nil, nil, nil,
		func(context.Context) (money.Amount, error) { return money.MustParse("58.5"), nil })
	router := gin.New()
	router.GET("/analytics/dashboard-summary", func(c *gin.Context) {
		c.Set("X-User-Id", userID)
		c.Next()
	}, analyticsHandler.GetDashboardSummary(service))

	tests := []struct {
		name         string
		query        string
		wantExpenses int64
		wantIncome   int64
		wantMonthly  map[string]int64 // month -> expenses
	}{
		{"single last day (ledger)", "date_from=2025-01-31&date_to=2025-01-31", 4 + 8 + 32, 1000, map[string]int64{"2025-01": 44}},
		{"whole month (rollup)", "date_from=2025-01-01&date_to=2025-01-31", 2 + 4 + 8 + 32, 1000, map[string]int64{"2025-01": 46}},
		{"whole month with account filter (ledger)", "date_from=2025-01-01&date_to=2025-01-31&account_id=" + accountID, 2 + 4 + 8 + 32, 1000, map[string]int64{"2025-01": 46}},
		{"two whole months (rollup)", "date_from=2025-01-01&date_to=2025-02-28", 2 + 4 + 8 + 32 + 16 + 64, 1000, map[string]int64{"2025-01": 46, "2025-02": 80}},
		{"partial month then whole month", "date_from=2025-01-15&date_to=2025-02-28", 4 + 8 + 32 + 16 + 64, 1000, map[string]int64{"2025-01": 44, "2025-02": 80}},
		{"reversed range", "date_from=2025-01-31&date_to=2025-01-01", 2 + 4 + 8 + 32, 1000, map[string]int64{"2025-01": 46}},
		{"day after the last day", "date_from=2025-02-01&date_to=2025-02-01", 16, 0, map[string]int64{"2025-02": 16}},
		{"bills only", "date_from=2025-01-01&date_to=2025-01-31&type=bill", 2 + 4 + 8 + 32, 0, map[string]int64{"2025-01": 46}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			rec := httptest.NewRecorder()
			router.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/analytics/dashboard-summary?"+tt.query, nil))
			require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
			var got analyticsdto.DashboardSummaryResponse
			require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &got))

			moneytest.Equal(t, tt.wantExpenses, got.TotalExpenses)
			moneytest.Equal(t, tt.wantIncome, got.TotalIncome)

			categoryTotal := money.Zero
			for _, c := range got.CategoryExpenses {
				categoryTotal = categoryTotal.Add(c.Value)
			}
			moneytest.Equal(t, tt.wantExpenses, categoryTotal, "category expenses")

			gotMonthly := map[string]int64{}
			for _, m := range got.MonthlySummary {
				gotMonthly[m.Month] = m.Gastos.IntPart()
			}
			require.Equal(t, tt.wantMonthly, gotMonthly)
		})
	}
}

// Every aggregate falls back to the same USD->DOP rate (60, like the other
// modules) when given a non-positive rate; categories used to fall back to 1
// (no conversion) while monthly and totals used 60.
func TestAnalyticsRepository_RateFallbackIsConsistent(t *testing.T) {
	t.Parallel()

	db := SetUpTest()
	userID, _ := seedAnalyticsUser(t, db, []analyticsFixtureTx{
		{10, "bill", "USD", time.Date(2025, 1, 15, 12, 0, 0, 0, time.UTC)},
		{5, "income", "USD", time.Date(2025, 1, 15, 12, 0, 0, 0, time.UTC)},
	})
	repo := analyticsRepo.NewAnalyticsRepository(db)

	tests := []struct {
		name     string
		from, to time.Time
	}{
		{"partial month (ledger)", time.Date(2025, 1, 15, 0, 0, 0, 0, time.UTC), time.Date(2025, 1, 16, 0, 0, 0, 0, time.UTC)},
		{"whole month (rollup)", time.Date(2025, 1, 1, 4, 0, 0, 0, time.UTC), time.Date(2025, 2, 1, 4, 0, 0, 0, time.UTC)}, // local months
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			ctx := context.Background()

			categories, err := repo.GetCategoryExpensesInRange(ctx, userID, money.Zero, tt.from, tt.to, "", "", "", nil, nil)
			require.NoError(t, err)
			require.Len(t, categories, 1)
			moneytest.Equal(t, 600, categories[0].TotalAmount)

			monthly, err := repo.GetMonthlySummaryInRange(ctx, userID, money.Zero, tt.from, tt.to, "", "", "", nil, nil)
			require.NoError(t, err)
			require.Len(t, monthly, 1)
			moneytest.Equal(t, 600, monthly[0].TotalBill)
			moneytest.Equal(t, 300, monthly[0].TotalIncome)

			totals, err := repo.GetTotalsInRange(ctx, userID, money.Zero, tt.from, tt.to, "", "", "", nil, nil)
			require.NoError(t, err)
			moneytest.Equal(t, 600, totals.TotalBill)
			moneytest.Equal(t, 300, totals.TotalIncome)
		})
	}

	t.Run("all time", func(t *testing.T) {
		t.Parallel()
		ctx := context.Background()

		categories, err := repo.GetCategoryExpenses(ctx, userID, money.Zero)
		require.NoError(t, err)
		require.Len(t, categories, 1)
		moneytest.Equal(t, 600, categories[0].TotalAmount)

		monthly, err := repo.GetMonthlySummary(ctx, userID, money.Zero)
		require.NoError(t, err)
		require.Len(t, monthly, 1)
		moneytest.Equal(t, 600, monthly[0].TotalBill)

		totals, err := repo.GetTotals(ctx, userID, money.Zero)
		require.NoError(t, err)
		moneytest.Equal(t, 600, totals.TotalBill)
		moneytest.Equal(t, 300, totals.TotalIncome)
	})
}
