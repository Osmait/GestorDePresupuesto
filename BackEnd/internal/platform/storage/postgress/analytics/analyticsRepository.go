package postgress

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"github.com/osmait/gestorDePresupuesto/internal/domain/analytics"
)

func NewAnalyticsRepository(db *sql.DB) *AnalyticsRepository {
	return &AnalyticsRepository{db: db}
}

type AnalyticsRepository struct {
	db *sql.DB
}

func (a *AnalyticsRepository) GetCategoryExpensesInRange(ctx context.Context, userID string, usdToDop float64, dateFrom time.Time, dateTo time.Time, accountID string, categoryID string, transactionType string) ([]*analytics.CategoryExpenseRepository, error) {
	if usdToDop <= 0 {
		usdToDop = 60
	}

	query := `
		SELECT c.id,
			c.name,
			COALESCE(SUM(CASE
				WHEN t.currency = 'USD' THEN ABS(t.amount) * $2
				ELSE ABS(t.amount)
			END), 0) as total,
			c.color,
			COUNT(*) as transaction_count,
			COALESCE(SUM(CASE WHEN t.currency = 'DOP' THEN ABS(t.amount) ELSE 0 END), 0) as dop_total,
			COALESCE(SUM(CASE WHEN t.currency = 'USD' THEN ABS(t.amount) ELSE 0 END), 0) as usd_total
		FROM transactions t
		JOIN categorys c ON t.category_id = c.id
		WHERE t.user_id = $1
			AND t.type_transation = 'bill'
			AND (NULLIF($5, '') IS NULL OR t.account_id::text = $5)
			AND (NULLIF($6, '') IS NULL OR t.category_id::text = $6)
			AND ($7 = '' OR $7 = 'bill')
			AND t.created_at >= $3 AND t.created_at <= $4
		GROUP BY c.id, c.name, c.color
	`

	rows, err := a.db.QueryContext(ctx, query, userID, usdToDop, dateFrom, dateTo, accountID, categoryID, transactionType)
	if err != nil {
		return nil, fmt.Errorf("error getting category expenses in range: %w", err)
	}

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
			return nil, fmt.Errorf("error scanning category expenses in range: %w", err)
		}
		categoryExpenses = append(categoryExpenses, &categoryExpense)
	}

	return categoryExpenses, nil
}

func (a *AnalyticsRepository) GetCategoryExpenses(ctx context.Context, userID string, usdToDop float64) ([]*analytics.CategoryExpenseRepository, error) {
	if usdToDop <= 0 {
		usdToDop = 60
	}

	query := `
		SELECT c.id,
			c.name,
			COALESCE(SUM(CASE
				WHEN t.currency = 'USD' THEN ABS(t.amount) * $2
				ELSE ABS(t.amount)
			END), 0) as total,
			c.color,
			COUNT(*) as transaction_count,
			COALESCE(SUM(CASE WHEN t.currency = 'DOP' THEN ABS(t.amount) ELSE 0 END), 0) as dop_total,
			COALESCE(SUM(CASE WHEN t.currency = 'USD' THEN ABS(t.amount) ELSE 0 END), 0) as usd_total
		FROM transactions t
		JOIN categorys c ON t.category_id = c.id
		WHERE t.user_id = $1 AND t.type_transation = 'bill'
		GROUP BY c.id, c.name, c.color
	`

	rows, err := a.db.QueryContext(ctx, query, userID, usdToDop)
	if err != nil {
		return nil, fmt.Errorf("error getting category expenses: %w", err)
	}

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
			return nil, fmt.Errorf("error scanning category expenses: %w", err)
		}
		categoryExpenses = append(categoryExpenses, &categoryExpense)
	}

	return categoryExpenses, nil
}

func (a *AnalyticsRepository) GetMonthlySummary(ctx context.Context, userID string, usdToDop float64) ([]*analytics.MonthlySummaryRepository, error) {
	if usdToDop <= 0 {
		usdToDop = 60
	}

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
				WHEN type_transation = 'bill' AND currency = 'USD' THEN ABS(amount) * $2
				WHEN type_transation = 'bill' THEN ABS(amount)
				ELSE 0
			END), 0) as total_bill
		FROM transactions
		WHERE user_id = $1
		GROUP BY year, month
		ORDER BY year, month
	`

	rows, err := a.db.QueryContext(ctx, query, userID, usdToDop)
	if err != nil {
		return nil, fmt.Errorf("error getting monthly summary: %w", err)
	}

	defer func() { _ = rows.Close() }()

	var monthlySummaries []*analytics.MonthlySummaryRepository

	for rows.Next() {
		var monthlySummary analytics.MonthlySummaryRepository
		var year int
		var month int
		err := rows.Scan(&year, &month, &monthlySummary.TotalIncome, &monthlySummary.TotalBill)
		if err != nil {
			return nil, fmt.Errorf("error scanning monthly summary: %w", err)
		}
		monthlySummary.Year = year
		monthlySummary.Month = time.Month(month)
		monthlySummaries = append(monthlySummaries, &monthlySummary)
	}

	return monthlySummaries, nil
}

func (a *AnalyticsRepository) GetMonthlySummaryInRange(ctx context.Context, userID string, usdToDop float64, dateFrom time.Time, dateTo time.Time, accountID string, categoryID string, transactionType string) ([]*analytics.MonthlySummaryRepository, error) {
	if usdToDop <= 0 {
		usdToDop = 60
	}

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
				WHEN type_transation = 'bill' AND currency = 'USD' THEN ABS(amount) * $2
				WHEN type_transation = 'bill' THEN ABS(amount)
				ELSE 0
			END), 0) as total_bill
		FROM transactions
		WHERE user_id = $1
			AND (NULLIF($5, '') IS NULL OR account_id::text = $5)
			AND (NULLIF($6, '') IS NULL OR category_id::text = $6)
			AND (NULLIF($7, '') IS NULL OR type_transation::text = $7)
			AND created_at >= $3 AND created_at <= $4
		GROUP BY year, month
		ORDER BY year, month
	`

	rows, err := a.db.QueryContext(ctx, query, userID, usdToDop, dateFrom, dateTo, accountID, categoryID, transactionType)
	if err != nil {
		return nil, fmt.Errorf("error getting monthly summary in range: %w", err)
	}

	defer func() { _ = rows.Close() }()

	var monthlySummaries []*analytics.MonthlySummaryRepository

	for rows.Next() {
		var monthlySummary analytics.MonthlySummaryRepository
		var year int
		var month int
		err := rows.Scan(&year, &month, &monthlySummary.TotalIncome, &monthlySummary.TotalBill)
		if err != nil {
			return nil, fmt.Errorf("error scanning monthly summary in range: %w", err)
		}
		monthlySummary.Year = year
		monthlySummary.Month = time.Month(month)
		monthlySummaries = append(monthlySummaries, &monthlySummary)
	}

	return monthlySummaries, nil
}

func (a *AnalyticsRepository) GetTotals(ctx context.Context, userID string, usdToDop float64) (*analytics.TotalsRepository, error) {
	if usdToDop <= 0 {
		usdToDop = 60
	}

	query := `
		SELECT
			COALESCE(SUM(CASE
				WHEN type_transation = 'income' AND currency = 'USD' THEN amount * $2
				WHEN type_transation = 'income' THEN amount
				ELSE 0
			END), 0) as total_income,
			COALESCE(SUM(CASE
				WHEN type_transation = 'bill' AND currency = 'USD' THEN ABS(amount) * $2
				WHEN type_transation = 'bill' THEN ABS(amount)
				ELSE 0
			END), 0) as total_bill
		FROM transactions
		WHERE user_id = $1
	`

	var totals analytics.TotalsRepository
	if err := a.db.QueryRowContext(ctx, query, userID, usdToDop).Scan(&totals.TotalIncome, &totals.TotalBill); err != nil {
		return nil, err
	}

	return &totals, nil
}

func (a *AnalyticsRepository) GetTotalsInRange(ctx context.Context, userID string, usdToDop float64, dateFrom time.Time, dateTo time.Time, accountID string, categoryID string, transactionType string) (*analytics.TotalsRepository, error) {
	if usdToDop <= 0 {
		usdToDop = 60
	}

	query := `
		SELECT
			COALESCE(SUM(CASE
				WHEN type_transation = 'income' AND currency = 'USD' THEN amount * $2
				WHEN type_transation = 'income' THEN amount
				ELSE 0
			END), 0) as total_income,
			COALESCE(SUM(CASE
				WHEN type_transation = 'bill' AND currency = 'USD' THEN ABS(amount) * $2
				WHEN type_transation = 'bill' THEN ABS(amount)
				ELSE 0
			END), 0) as total_bill
		FROM transactions
		WHERE user_id = $1
			AND (NULLIF($5, '') IS NULL OR account_id::text = $5)
			AND (NULLIF($6, '') IS NULL OR category_id::text = $6)
			AND (NULLIF($7, '') IS NULL OR type_transation::text = $7)
			AND created_at >= $3 AND created_at <= $4
	`

	var totals analytics.TotalsRepository
	if err := a.db.QueryRowContext(ctx, query, userID, usdToDop, dateFrom, dateTo, accountID, categoryID, transactionType).Scan(&totals.TotalIncome, &totals.TotalBill); err != nil {
		return nil, err
	}

	return &totals, nil
}
