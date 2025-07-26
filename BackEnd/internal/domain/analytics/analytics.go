package analytics

import "time"

type CategoryExpense struct {
	ID    string  `json:"id"`
	Label string  `json:"label"`
	Value float64 `json:"value"`
	Color string  `json:"color"`
}

type MonthlySummary struct {
	Month    string  `json:"month"`
	Income   float64 `json:"income"`
	Expenses float64 `json:"expenses"`
}

type AnalyticsRepository interface {
	GetCategoryExpenses(userID string) ([]CategoryExpense, error)
	GetMonthlySummary(userID string) ([]MonthlySummary, error)
}

type AnalyticsService interface {
	GetCategoryExpenses(userID string) ([]CategoryExpense, error)
	GetMonthlySummary(userID string) ([]MonthlySummary, error)
}

type GetCategoryExpensesResponse struct {
	ID    string  `json:"id"`
	Label string  `json:"label"`
	Value float64 `json:"value"`
	Color string  `json:"color"`
}

type GetMonthlySummaryResponse struct {
	Month    string  `json:"month"`
	Income   float64 `json:"income"`
	Expenses float64 `json:"expenses"`
}

type CategoryExpenseRepository struct {
	CategoryName  string
	TotalAmount   float64
	CategoryColor string
}

type MonthlySummaryRepository struct {
	Year        int
	Month       time.Month
	TotalIncome float64
	TotalBill   float64
}
