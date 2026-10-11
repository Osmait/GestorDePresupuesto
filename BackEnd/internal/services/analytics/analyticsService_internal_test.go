package analytics

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/osmait/gestorDePresupuesto/internal/domain/analytics"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money/moneytest"
)

// SQL aggregates of amount * rate carry many fractional digits; the service
// rounds them half-even to cents for presentation.
func TestToCategoryExpense_RoundsAggregatesToCents(t *testing.T) {
	t.Parallel()

	got := toCategoryExpense(&analytics.CategoryExpenseRepository{
		CategoryID:       "c",
		TotalAmount:      money.FromInt(1175).Add(money.MustParse("0.07").Mul(money.MustParse("58.7512345"))), // 1179.112586415
		DopTotal:         money.FromInt(1175),
		UsdTotal:         money.MustParse("0.0700"),
		TransactionCount: 2,
	})
	moneytest.Equal(t, "1179.11", got.Value)
	moneytest.Equal(t, "1175", got.DopTotal)
	moneytest.Equal(t, "0.07", got.UsdTotal)

	summary := toMonthlySummary(&analytics.MonthlySummaryRepository{
		Year: 2026, Month: time.March,
		TotalIncome: money.MustParse("100.125"), // tie -> even
		TotalBill:   money.MustParse("100.135"),
	})
	assert.Equal(t, "2026-03", summary.Month)
	moneytest.Equal(t, "100.12", summary.Income)
	moneytest.Equal(t, "100.14", summary.Expenses)
}

func TestResolveUsdToDop_FallsBackTo60(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	moneytest.Equal(t, 60, (&AnalyticsService{}).resolveUsdToDop(ctx))
	failing := &AnalyticsService{usdToDopRateFn: func(context.Context) (money.Amount, error) { return money.Zero, errors.New("down") }}
	moneytest.Equal(t, 60, failing.resolveUsdToDop(ctx))
	nonPositive := &AnalyticsService{usdToDopRateFn: func(context.Context) (money.Amount, error) { return money.Zero, nil }}
	moneytest.Equal(t, 60, nonPositive.resolveUsdToDop(ctx))
	ok := &AnalyticsService{usdToDopRateFn: func(context.Context) (money.Amount, error) { return money.MustParse("58.75"), nil }}
	moneytest.Equal(t, "58.75", ok.resolveUsdToDop(ctx))
}

// date_from/date_to are inclusive calendar days: the dashboard aggregates
// [date_from 00:00 UTC, date_to + 1 day 00:00 UTC), the UTC days the
// transaction list filters on.
func TestDashboardDateRange(t *testing.T) {
	t.Parallel()

	santoDomingo, err := time.LoadLocation("America/Santo_Domingo")
	if err != nil {
		t.Skipf("tzdata unavailable: %v", err)
	}
	utc := func(y int, m time.Month, d int) time.Time { return time.Date(y, m, d, 0, 0, 0, 0, time.UTC) }
	now := time.Date(2025, time.March, 10, 23, 30, 0, 0, santoDomingo) // 2025-03-11 03:30 UTC

	tests := []struct {
		name             string
		dateFrom, dateTo time.Time
		wantFrom, wantTo time.Time
	}{
		{"last day is included whole", utc(2025, 1, 1), utc(2025, 1, 31), utc(2025, 1, 1), utc(2025, 2, 1)},
		{"single day", utc(2025, 1, 31), utc(2025, 1, 31), utc(2025, 1, 31), utc(2025, 2, 1)},
		{"reversed range is swapped", utc(2025, 1, 31), utc(2025, 1, 1), utc(2025, 1, 1), utc(2025, 2, 1)},
		{"end of year", utc(2024, 12, 1), utc(2024, 12, 31), utc(2024, 12, 1), utc(2025, 1, 1)},
		{"leap day", utc(2024, 2, 1), utc(2024, 2, 29), utc(2024, 2, 1), utc(2024, 3, 1)},
		{"bounds keep their own calendar day", time.Date(2025, 1, 1, 23, 0, 0, 0, santoDomingo), time.Date(2025, 1, 31, 23, 59, 59, 0, santoDomingo), utc(2025, 1, 1), utc(2025, 2, 1)},
		{"no bounds: current Santo Domingo year to date, today included", time.Time{}, time.Time{}, utc(2025, 1, 1), utc(2025, 3, 11)},
		{"one bound only: default range", utc(2024, 6, 1), time.Time{}, utc(2025, 1, 1), utc(2025, 3, 11)},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			from, to := dashboardDateRange(tt.dateFrom, tt.dateTo, now)
			assert.True(t, from.Equal(tt.wantFrom), "from: want %s got %s", tt.wantFrom, from)
			assert.True(t, to.Equal(tt.wantTo), "to: want %s got %s", tt.wantTo, to)
		})
	}
}

// A date_to parsed as the handler does (00:00 UTC) covers the whole day.
func TestDashboardDateRange_LastDayInstants(t *testing.T) {
	t.Parallel()

	santoDomingo, err := time.LoadLocation("America/Santo_Domingo")
	if err != nil {
		t.Skipf("tzdata unavailable: %v", err)
	}
	dateFrom, err := time.Parse("2006-01-02", "2025-01-01")
	require.NoError(t, err)
	dateTo, err := time.Parse("2006-01-02", "2025-01-31")
	require.NoError(t, err)
	from, to := dashboardDateRange(dateFrom, dateTo, time.Now())

	tests := []struct {
		name    string
		at      time.Time
		include bool
	}{
		{"first instant", time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC), true},
		{"before the first day", time.Date(2024, 12, 31, 23, 59, 59, 999999000, time.UTC), false},
		{"18:00 Santo Domingo on the last day", time.Date(2025, 1, 31, 18, 0, 0, 0, santoDomingo), true},
		{"noon UTC on the last day", time.Date(2025, 1, 31, 12, 0, 0, 0, time.UTC), true},
		{"last microsecond of the last day", time.Date(2025, 1, 31, 23, 59, 59, 999999000, time.UTC), true},
		{"00:00 UTC the day after", time.Date(2025, 2, 1, 0, 0, 0, 0, time.UTC), false},
		{"00:00 Santo Domingo the day after", time.Date(2025, 2, 1, 0, 0, 0, 0, santoDomingo), false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			included := !tt.at.Before(from) && tt.at.Before(to)
			assert.Equal(t, tt.include, included, "%s in [%s, %s)", tt.at.UTC(), from, to)
		})
	}
}
