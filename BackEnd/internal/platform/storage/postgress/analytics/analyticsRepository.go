package postgress

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"sync/atomic"
	"time"

	"github.com/rs/zerolog/log"

	"github.com/osmait/gestorDePresupuesto/internal/domain/analytics"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
	txhelper "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/txhelper"
)

func NewAnalyticsRepository(db *sql.DB) *AnalyticsRepository {
	return &AnalyticsRepository{db: db}
}

// AnalyticsRepository serves the analytics aggregates.
//
// Large ranges are read from transaction_monthly_rollup (migration 000054):
// per (user, UTC month, category, type, currency) SUM(amount) and COUNT(*),
// maintained by triggers in the same transaction as every write to
// transactions. A date range [from, to] is split into the whole UTC months it
// contains (read from the rollup) and the partial months at its edges (read
// from transactions), so results are exactly those of aggregating the ledger.
// Currency conversion is applied to the sums (sum(amount)*rate ==
// sum(amount*rate) in NUMERIC arithmetic, which is exact).
//
// The ledger is aggregated directly (the original queries) when a filter the
// rollup does not have is set (account, min/max amount), when the range
// contains no whole month, or when the session TimeZone is not UTC: months are
// bucketed by EXTRACT(... FROM created_at), i.e. in the session time zone, and
// the rollup buckets in UTC.
type AnalyticsRepository struct {
	db *sql.DB
	// sessionTZ caches whether the DB session buckets months in UTC.
	sessionTZ atomic.Int32
}

const (
	sessionTZUnknown int32 = iota
	sessionTZUTC
	sessionTZOther
)

// Unbounded range used to serve the all-time aggregates from the ledger
// queries (fallback when the rollup cannot be used).
var (
	allTimeFrom = time.Date(1, time.January, 1, 0, 0, 0, 0, time.UTC)
	allTimeTo   = time.Date(9999, time.December, 31, 23, 59, 59, 0, time.UTC)
)

// utcZoneNames are the PostgreSQL TimeZone values that are UTC at every
// instant (compared case-insensitively).
var utcZoneNames = map[string]bool{
	"utc": true, "etc/utc": true, "uct": true, "etc/uct": true,
	"gmt": true, "etc/gmt": true, "gmt0": true, "etc/gmt0": true,
	"gmt+0": true, "gmt-0": true, "etc/gmt+0": true, "etc/gmt-0": true,
	"greenwich": true, "etc/greenwich": true, "universal": true,
	"etc/universal": true, "zulu": true, "etc/zulu": true,
}

// rollupUsable reports whether the session buckets months in UTC, as the
// rollup does. Checked once per process, through the request transaction.
func (a *AnalyticsRepository) rollupUsable(ctx context.Context) (bool, error) {
	switch a.sessionTZ.Load() {
	case sessionTZUTC:
		return true, nil
	case sessionTZOther:
		return false, nil
	}
	var tz string
	if err := txhelper.FromContext(ctx, a.db).QueryRowContext(ctx, "SELECT current_setting('TimeZone')").Scan(&tz); err != nil {
		return false, fmt.Errorf("error reading session time zone: %w", err)
	}
	if utcZoneNames[strings.ToLower(tz)] {
		a.sessionTZ.Store(sessionTZUTC)
		return true, nil
	}
	if a.sessionTZ.CompareAndSwap(sessionTZUnknown, sessionTZOther) {
		log.Warn().Str("timezone", tz).Msg("analytics: DB session time zone is not UTC, aggregating the ledger instead of the monthly rollup")
	}
	return false, nil
}

// wholeMonths returns the UTC month boundaries [start, end) of the whole
// months contained in [from, to]; ok is false when there is none.
func wholeMonths(from, to time.Time) (start, end time.Time, ok bool) {
	f, t := from.UTC(), to.UTC()
	start = time.Date(f.Year(), f.Month(), 1, 0, 0, 0, 0, time.UTC)
	if start.Before(f) {
		start = start.AddDate(0, 1, 0)
	}
	end = time.Date(t.Year(), t.Month(), 1, 0, 0, 0, 0, time.UTC)
	return start, end, start.Before(end)
}

// rangeUsesRollup decides whether a ranged aggregate can be served from the
// rollup and returns the whole-month span to read from it.
func (a *AnalyticsRepository) rangeUsesRollup(ctx context.Context, dateFrom, dateTo time.Time, accountID string, minAmount, maxAmount *money.Amount) (time.Time, time.Time, bool, error) {
	if accountID != "" || minAmount != nil || maxAmount != nil {
		return time.Time{}, time.Time{}, false, nil
	}
	start, end, ok := wholeMonths(dateFrom, dateTo)
	if !ok {
		return time.Time{}, time.Time{}, false, nil
	}
	usable, err := a.rollupUsable(ctx)
	if err != nil || !usable {
		return time.Time{}, time.Time{}, false, err
	}
	return start, end, true, nil
}

// Shared SELECT lists over a source with columns (category_id | month,
// type_transation, currency, amount, cnt). currency is the empty string for
// NULL.
const (
	categoryExpenseColumns = `
			c.id,
			c.name,
			COALESCE(SUM(CASE WHEN s.currency = 'USD' THEN s.amount * $2 ELSE s.amount END), 0) AS total,
			c.color,
			SUM(s.cnt)::bigint AS transaction_count,
			COALESCE(SUM(CASE WHEN s.currency = 'DOP' THEN s.amount ELSE 0 END), 0) AS dop_total,
			COALESCE(SUM(CASE WHEN s.currency = 'USD' THEN s.amount ELSE 0 END), 0) AS usd_total`

	incomeBillColumns = `
			COALESCE(SUM(CASE
				WHEN s.type_transation = 'income' AND s.currency = 'USD' THEN s.amount * $2
				WHEN s.type_transation = 'income' THEN s.amount
				ELSE 0
			END), 0) AS total_income,
			COALESCE(SUM(CASE
				WHEN s.type_transation = 'bill' AND s.currency = 'USD' THEN s.amount * $2
				WHEN s.type_transation = 'bill' THEN s.amount
				ELSE 0
			END), 0) AS total_bill`

	// Ranged sources: $1 user, $3/$4 requested range (inclusive), $5/$6 the
	// whole UTC months [start, end) read from the rollup; the ledger covers
	// [$3, $5) and [$6, $4]. $7 category filter, $8 type filter ('' = any;
	// monthly source only).
	rangedBillSource = `
		SELECT r.category_id, r.currency, r.amount_sum AS amount, r.tx_count AS cnt
		FROM transaction_monthly_rollup r
		WHERE r.user_id = $1
			AND r.type_transation = 'bill'
			AND r.month >= ($5::timestamptz AT TIME ZONE 'UTC')::date AND r.month < ($6::timestamptz AT TIME ZONE 'UTC')::date
			AND (NULLIF($7, '') IS NULL OR r.category_id = $7)
		UNION ALL
		SELECT t.category_id, COALESCE(t.currency, ''), t.amount, 1
		FROM transactions t
		WHERE t.user_id = $1
			AND t.type_transation = 'bill'
			AND (NULLIF($7, '') IS NULL OR t.category_id = $7)
			AND ((t.created_at >= $3 AND t.created_at < $5) OR (t.created_at >= $6 AND t.created_at <= $4))`

	rangedMonthlySource = `
		SELECT r.month, r.type_transation, r.currency, r.amount_sum AS amount
		FROM transaction_monthly_rollup r
		WHERE r.user_id = $1
			AND r.month >= ($5::timestamptz AT TIME ZONE 'UTC')::date AND r.month < ($6::timestamptz AT TIME ZONE 'UTC')::date
			AND (NULLIF($7, '') IS NULL OR r.category_id = $7)
			AND (NULLIF($8, '') IS NULL OR r.type_transation::text = $8)
		UNION ALL
		SELECT (date_trunc('month', t.created_at AT TIME ZONE 'UTC'))::date, t.type_transation, COALESCE(t.currency, ''), t.amount
		FROM transactions t
		WHERE t.user_id = $1
			AND (NULLIF($7, '') IS NULL OR t.category_id = $7)
			AND (NULLIF($8, '') IS NULL OR t.type_transation::text = $8)
			AND ((t.created_at >= $3 AND t.created_at < $5) OR (t.created_at >= $6 AND t.created_at <= $4))`
)

func (a *AnalyticsRepository) GetCategoryExpensesInRange(ctx context.Context, userID string, usdToDop money.Amount, dateFrom time.Time, dateTo time.Time, accountID string, categoryID string, transactionType string, minAmount *money.Amount, maxAmount *money.Amount) ([]*analytics.CategoryExpenseRepository, error) {
	if !usdToDop.IsPositive() {
		usdToDop = money.FromInt(1)
	}

	start, end, useRollup, err := a.rangeUsesRollup(ctx, dateFrom, dateTo, accountID, minAmount, maxAmount)
	if err != nil {
		return nil, fmt.Errorf("error getting category expenses in range: %w", err)
	}
	if !useRollup {
		return a.ledgerCategoryExpenses(ctx, userID, usdToDop, dateFrom, dateTo, accountID, categoryID, transactionType, minAmount, maxAmount)
	}
	if transactionType != "" && transactionType != "bill" {
		// category expenses only count bills
		return nil, nil
	}

	query := `WITH s AS (` + rangedBillSource + `
		)
		SELECT` + categoryExpenseColumns + `
		FROM s
		JOIN categorys c ON s.category_id = c.id
		GROUP BY c.id, c.name, c.color`

	rows, err := txhelper.FromContext(ctx, a.db).QueryContext(ctx, query,
		userID, usdToDop, dateFrom, dateTo, start, end, categoryID)
	if err != nil {
		return nil, fmt.Errorf("error getting category expenses in range: %w", err)
	}
	return scanCategoryExpenses(rows, "in range")
}

// GetCategoryExpenses aggregates the user's bills of all time per category.
func (a *AnalyticsRepository) GetCategoryExpenses(ctx context.Context, userID string, usdToDop money.Amount) ([]*analytics.CategoryExpenseRepository, error) {
	if !usdToDop.IsPositive() {
		usdToDop = money.FromInt(1)
	}

	usable, err := a.rollupUsable(ctx)
	if err != nil {
		return nil, fmt.Errorf("error getting category expenses: %w", err)
	}
	if !usable {
		return a.ledgerCategoryExpenses(ctx, userID, usdToDop, allTimeFrom, allTimeTo, "", "", "", nil, nil)
	}

	query := `
		SELECT` + categoryExpenseColumns + `
		FROM (
			SELECT r.category_id, r.currency, r.amount_sum AS amount, r.tx_count AS cnt
			FROM transaction_monthly_rollup r
			WHERE r.user_id = $1 AND r.type_transation = 'bill'
		) s
		JOIN categorys c ON s.category_id = c.id
		GROUP BY c.id, c.name, c.color
	`

	rows, err := txhelper.FromContext(ctx, a.db).QueryContext(ctx, query, userID, usdToDop)
	if err != nil {
		return nil, fmt.Errorf("error getting category expenses: %w", err)
	}
	return scanCategoryExpenses(rows, "")
}

// GetMonthlySummary aggregates income and bills of all time per month.
func (a *AnalyticsRepository) GetMonthlySummary(ctx context.Context, userID string, usdToDop money.Amount) ([]*analytics.MonthlySummaryRepository, error) {
	if !usdToDop.IsPositive() {
		usdToDop = money.FromInt(60)
	}

	usable, err := a.rollupUsable(ctx)
	if err != nil {
		return nil, fmt.Errorf("error getting monthly summary: %w", err)
	}
	if !usable {
		return a.ledgerMonthlySummary(ctx, userID, usdToDop, allTimeFrom, allTimeTo, "", "", "", nil, nil)
	}

	query := `
		SELECT
			EXTRACT(YEAR FROM s.month)::int AS year,
			EXTRACT(MONTH FROM s.month)::int AS month,` + incomeBillColumns + `
		FROM (
			SELECT r.month, r.type_transation, r.currency, r.amount_sum AS amount
			FROM transaction_monthly_rollup r
			WHERE r.user_id = $1
		) s
		GROUP BY s.month
		ORDER BY s.month
	`

	rows, err := txhelper.FromContext(ctx, a.db).QueryContext(ctx, query, userID, usdToDop)
	if err != nil {
		return nil, fmt.Errorf("error getting monthly summary: %w", err)
	}
	return scanMonthlySummaries(rows, "")
}

func (a *AnalyticsRepository) GetMonthlySummaryInRange(ctx context.Context, userID string, usdToDop money.Amount, dateFrom time.Time, dateTo time.Time, accountID string, categoryID string, transactionType string, minAmount *money.Amount, maxAmount *money.Amount) ([]*analytics.MonthlySummaryRepository, error) {
	if !usdToDop.IsPositive() {
		usdToDop = money.FromInt(60)
	}

	start, end, useRollup, err := a.rangeUsesRollup(ctx, dateFrom, dateTo, accountID, minAmount, maxAmount)
	if err != nil {
		return nil, fmt.Errorf("error getting monthly summary in range: %w", err)
	}
	if !useRollup {
		return a.ledgerMonthlySummary(ctx, userID, usdToDop, dateFrom, dateTo, accountID, categoryID, transactionType, minAmount, maxAmount)
	}

	query := `WITH s AS (` + rangedMonthlySource + `
		)
		SELECT
			EXTRACT(YEAR FROM s.month)::int AS year,
			EXTRACT(MONTH FROM s.month)::int AS month,` + incomeBillColumns + `
		FROM s
		GROUP BY s.month
		ORDER BY s.month`

	rows, err := txhelper.FromContext(ctx, a.db).QueryContext(ctx, query,
		userID, usdToDop, dateFrom, dateTo, start, end, categoryID, transactionType)
	if err != nil {
		return nil, fmt.Errorf("error getting monthly summary in range: %w", err)
	}
	return scanMonthlySummaries(rows, "in range")
}

func (a *AnalyticsRepository) GetTotals(ctx context.Context, userID string, usdToDop money.Amount) (*analytics.TotalsRepository, error) {
	if !usdToDop.IsPositive() {
		usdToDop = money.FromInt(60)
	}

	query := `
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
	`

	var totals analytics.TotalsRepository
	if err := txhelper.FromContext(ctx, a.db).QueryRowContext(ctx, query, userID, usdToDop).Scan(&totals.TotalIncome, &totals.TotalBill); err != nil {
		return nil, err
	}

	return &totals, nil
}

func (a *AnalyticsRepository) GetTotalsInRange(ctx context.Context, userID string, usdToDop money.Amount, dateFrom time.Time, dateTo time.Time, accountID string, categoryID string, transactionType string, minAmount *money.Amount, maxAmount *money.Amount) (*analytics.TotalsRepository, error) {
	if !usdToDop.IsPositive() {
		usdToDop = money.FromInt(60)
	}

	start, end, useRollup, err := a.rangeUsesRollup(ctx, dateFrom, dateTo, accountID, minAmount, maxAmount)
	if err != nil {
		return nil, err
	}
	if !useRollup {
		return a.ledgerTotals(ctx, userID, usdToDop, dateFrom, dateTo, accountID, categoryID, transactionType, minAmount, maxAmount)
	}

	query := `WITH s AS (` + rangedMonthlySource + `
		)
		SELECT` + incomeBillColumns + `
		FROM s`

	var totals analytics.TotalsRepository
	if err := txhelper.FromContext(ctx, a.db).QueryRowContext(ctx, query,
		userID, usdToDop, dateFrom, dateTo, start, end, categoryID, transactionType,
	).Scan(&totals.TotalIncome, &totals.TotalBill); err != nil {
		return nil, err
	}

	return &totals, nil
}

// ── Ledger aggregates (no rollup) ───────────────────────────────────────────

func (a *AnalyticsRepository) ledgerCategoryExpenses(ctx context.Context, userID string, usdToDop money.Amount, dateFrom time.Time, dateTo time.Time, accountID string, categoryID string, transactionType string, minAmount *money.Amount, maxAmount *money.Amount) ([]*analytics.CategoryExpenseRepository, error) {
	query := `
		SELECT c.id,
			c.name,
			COALESCE(SUM(CASE
				WHEN t.currency = 'USD' THEN t.amount * $2
				ELSE t.amount
			END), 0) as total,
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
			AND t.created_at >= $3 AND t.created_at <= $4
		GROUP BY c.id, c.name, c.color
	`

	rows, err := txhelper.FromContext(ctx, a.db).QueryContext(
		ctx,
		query,
		userID,
		usdToDop,
		dateFrom,
		dateTo,
		accountID,
		categoryID,
		transactionType,
		nullableAmountArg(minAmount),
		nullableAmountArg(maxAmount),
	)
	if err != nil {
		return nil, fmt.Errorf("error getting category expenses in range: %w", err)
	}
	return scanCategoryExpenses(rows, "in range")
}

func (a *AnalyticsRepository) ledgerMonthlySummary(ctx context.Context, userID string, usdToDop money.Amount, dateFrom time.Time, dateTo time.Time, accountID string, categoryID string, transactionType string, minAmount *money.Amount, maxAmount *money.Amount) ([]*analytics.MonthlySummaryRepository, error) {
	query := `
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
			AND created_at >= $3 AND created_at <= $4
		GROUP BY year, month
		ORDER BY year, month
	`

	rows, err := txhelper.FromContext(ctx, a.db).QueryContext(
		ctx,
		query,
		userID,
		usdToDop,
		dateFrom,
		dateTo,
		accountID,
		categoryID,
		transactionType,
		nullableAmountArg(minAmount),
		nullableAmountArg(maxAmount),
	)
	if err != nil {
		return nil, fmt.Errorf("error getting monthly summary in range: %w", err)
	}
	return scanMonthlySummaries(rows, "in range")
}

func (a *AnalyticsRepository) ledgerTotals(ctx context.Context, userID string, usdToDop money.Amount, dateFrom time.Time, dateTo time.Time, accountID string, categoryID string, transactionType string, minAmount *money.Amount, maxAmount *money.Amount) (*analytics.TotalsRepository, error) {
	query := `
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
			AND created_at >= $3 AND created_at <= $4
	`

	var totals analytics.TotalsRepository
	if err := txhelper.FromContext(ctx, a.db).QueryRowContext(
		ctx,
		query,
		userID,
		usdToDop,
		dateFrom,
		dateTo,
		accountID,
		categoryID,
		transactionType,
		nullableAmountArg(minAmount),
		nullableAmountArg(maxAmount),
	).Scan(&totals.TotalIncome, &totals.TotalBill); err != nil {
		return nil, err
	}

	return &totals, nil
}

func scanCategoryExpenses(rows *sql.Rows, what string) ([]*analytics.CategoryExpenseRepository, error) {
	defer func() { _ = rows.Close() }()

	var categoryExpenses []*analytics.CategoryExpenseRepository
	for rows.Next() {
		var categoryExpense analytics.CategoryExpenseRepository
		err := rows.Scan(
			&categoryExpense.CategoryID,
			&categoryExpense.CategoryName,
			&categoryExpense.TotalAmount,
			&categoryExpense.CategoryColor,
			&categoryExpense.TransactionCount,
			&categoryExpense.DopTotal,
			&categoryExpense.UsdTotal,
		)
		if err != nil {
			return nil, fmt.Errorf("error scanning category expenses %s: %w", what, err)
		}
		categoryExpenses = append(categoryExpenses, &categoryExpense)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error reading category expenses %s: %w", what, err)
	}

	return categoryExpenses, nil
}

func scanMonthlySummaries(rows *sql.Rows, what string) ([]*analytics.MonthlySummaryRepository, error) {
	defer func() { _ = rows.Close() }()

	var monthlySummaries []*analytics.MonthlySummaryRepository
	for rows.Next() {
		var monthlySummary analytics.MonthlySummaryRepository
		var year int
		var month int
		err := rows.Scan(&year, &month, &monthlySummary.TotalIncome, &monthlySummary.TotalBill)
		if err != nil {
			return nil, fmt.Errorf("error scanning monthly summary %s: %w", what, err)
		}
		monthlySummary.Year = year
		monthlySummary.Month = time.Month(month)
		monthlySummaries = append(monthlySummaries, &monthlySummary)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error reading monthly summary %s: %w", what, err)
	}

	return monthlySummaries, nil
}

func nullableAmountArg(value *money.Amount) any {
	if value == nil {
		return nil
	}

	return *value
}
