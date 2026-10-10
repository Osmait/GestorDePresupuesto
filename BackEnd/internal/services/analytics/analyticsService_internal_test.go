package analytics

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"

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

func TestResolveUsdToDop_FallsBackToNoConversion(t *testing.T) {
	t.Parallel()

	ctx := context.Background()
	moneytest.Equal(t, 1, (&AnalyticsService{}).resolveUsdToDop(ctx))
	failing := &AnalyticsService{usdToDopRateFn: func(context.Context) (money.Amount, error) { return money.Zero, errors.New("down") }}
	moneytest.Equal(t, 1, failing.resolveUsdToDop(ctx))
	ok := &AnalyticsService{usdToDopRateFn: func(context.Context) (money.Amount, error) { return money.MustParse("58.75"), nil }}
	moneytest.Equal(t, "58.75", ok.resolveUsdToDop(ctx))
}
