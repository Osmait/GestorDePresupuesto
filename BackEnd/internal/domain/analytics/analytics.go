package analytics

import (
	"time"

	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
)

type CategoryExpense struct {
	ID               string       `json:"id"`
	Label            string       `json:"label"`
	Value            money.Amount `json:"value"`
	Color            string       `json:"color"`
	TransactionCount int          `json:"transaction_count"`
	DopTotal         money.Amount `json:"dop_total"`
	UsdTotal         money.Amount `json:"usd_total"`
}

type MonthlySummary struct {
	Month    string       `json:"month"`
	Income   money.Amount `json:"income"`
	Expenses money.Amount `json:"expenses"`
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
	ID    string       `json:"id"`
	Label string       `json:"label"`
	Value money.Amount `json:"value"`
	Color string       `json:"color"`
}

type GetMonthlySummaryResponse struct {
	Month    string       `json:"month"`
	Income   money.Amount `json:"income"`
	Expenses money.Amount `json:"expenses"`
}

type CategoryExpenseRepository struct {
	CategoryID       string
	CategoryName     string
	TotalAmount      money.Amount
	CategoryColor    string
	TransactionCount int
	DopTotal         money.Amount
	UsdTotal         money.Amount
}

type MonthlySummaryRepository struct {
	Year        int
	Month       time.Month
	TotalIncome money.Amount
	TotalBill   money.Amount
}

type TotalsRepository struct {
	TotalIncome money.Amount
	TotalBill   money.Amount
}

type DashboardSummary struct {
	TotalIncome       money.Amount       `json:"total_income"`
	TotalExpenses     money.Amount       `json:"total_expenses"`
	NetAmount         money.Amount       `json:"net_amount"`
	UsdToDopRate      money.Amount       `json:"usd_to_dop_rate"`
	AccountsTotal     money.Amount       `json:"accounts_total"`
	InvestmentsTotal  money.Amount       `json:"investments_total"`
	CertificatesTotal money.Amount       `json:"certificates_total"`
	AccountsCount     int                `json:"accounts_count"`
	InvestmentsCount  int                `json:"investments_count"`
	CertificatesCount int                `json:"certificates_count"`
	CategoryExpenses  []*CategoryExpense `json:"category_expenses"`
	MonthlySummary    []*MonthlySummary  `json:"monthly_summary"`
}
