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

func (a *AnalyticsRepository) GetCategoryExpenses(ctx context.Context, userID string) ([]*analytics.CategoryExpenseRepository, error) {
	query := `SELECT c.name, SUM(t.amount), c.color FROM transactions t JOIN categorys c ON t.category_id = c.id WHERE t.user_id = $1 AND t. type_transation = 'bill' GROUP BY c.name, c.color`

	rows, err := a.db.QueryContext(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("error getting category expenses: %w", err)
	}

	defer func() { _ = rows.Close() }()

	var categoryExpenses []*analytics.CategoryExpenseRepository

	for rows.Next() {
		var categoryExpense analytics.CategoryExpenseRepository
		err := rows.Scan(&categoryExpense.CategoryName, &categoryExpense.TotalAmount, &categoryExpense.CategoryColor)
		if err != nil {
			return nil, fmt.Errorf("error scanning category expenses: %w", err)
		}
		categoryExpenses = append(categoryExpenses, &categoryExpense)
	}

	return categoryExpenses, nil
}

func (a *AnalyticsRepository) GetMonthlySummary(ctx context.Context, userID string) ([]*analytics.MonthlySummaryRepository, error) {
	query := `SELECT EXTRACT(YEAR FROM created_at) as year, 
               EXTRACT(MONTH FROM created_at) as month, 
               SUM(CASE WHEN type_transation = 'income' THEN amount ELSE 0 END) as total_income, 
               SUM(CASE WHEN type_transation = 'bill' THEN amount ELSE 0 END) as total_bill 
               FROM transactions WHERE user_id = $1 GROUP BY year, month ORDER BY year, month`

	rows, err := a.db.QueryContext(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("error getting monthly summary: %w", err)
	}

	defer func() { _ = rows.Close() }()

	var monthlySummaries []*analytics.MonthlySummaryRepository

	for rows.Next() {
		var monthlySummary analytics.MonthlySummaryRepository
		var year int
		var month time.Month
		err := rows.Scan(&year, &month, &monthlySummary.TotalIncome, &monthlySummary.TotalBill)
		if err != nil {
			return nil, fmt.Errorf("error scanning monthly summary: %w", err)
		}
		monthlySummary.Year = year
		monthlySummary.Month = month
		monthlySummaries = append(monthlySummaries, &monthlySummary)
	}

	return monthlySummaries, nil
}
