package analytics

import "time"

type CategoryExpense struct {
	ID               string  `json:"id"`
	Label            string  `json:"label"`
	Value            float64 `json:"value"`
	Color            string  `json:"color"`
	TransactionCount int     `json:"transaction_count"`
	DopTotal         float64 `json:"dop_total"`
	UsdTotal         float64 `json:"usd_total"`
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
	CategoryID       string
	CategoryName     string
	TotalAmount      float64
	CategoryColor    string
	TransactionCount int
	DopTotal         float64
	UsdTotal         float64
}

type MonthlySummaryRepository struct {
	Year        int
	Month       time.Month
	TotalIncome float64
	TotalBill   float64
}

type TotalsRepository struct {
	TotalIncome float64
	TotalBill   float64
}

type DashboardSummary struct {
	TotalIncome       float64            `json:"total_income"`
	TotalExpenses     float64            `json:"total_expenses"`
	NetAmount         float64            `json:"net_amount"`
	UsdToDopRate      float64            `json:"usd_to_dop_rate"`
	AccountsTotal     float64            `json:"accounts_total"`
	InvestmentsTotal  float64            `json:"investments_total"`
	CertificatesTotal float64            `json:"certificates_total"`
	AccountsCount     int                `json:"accounts_count"`
	InvestmentsCount  int                `json:"investments_count"`
	CertificatesCount int                `json:"certificates_count"`
	CategoryExpenses  []*CategoryExpense `json:"category_expenses"`
	MonthlySummary    []*MonthlySummary  `json:"monthly_summary"`
}
