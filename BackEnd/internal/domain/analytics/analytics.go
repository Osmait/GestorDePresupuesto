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
	TotalIncome       money.Amount `json:"total_income"`
	TotalExpenses     money.Amount `json:"total_expenses"`
	NetAmount         money.Amount `json:"net_amount"`
	UsdToDopRate      money.Amount `json:"usd_to_dop_rate"`
	AccountsTotal     money.Amount `json:"accounts_total"`
	InvestmentsTotal  money.Amount `json:"investments_total"`
	CertificatesTotal money.Amount `json:"certificates_total"`
	// BrokerCashTotal is the broker wallet (funded and not spent on
	// positions), in DOP.
	BrokerCashTotal money.Amount `json:"broker_cash_total"`
	// LoansReceivableTotal is the outstanding principal of active loans, in
	// DOP. LoansDefaultedTotal is that of defaulted loans: written off, shown
	// but not added to NetWorth.
	LoansReceivableTotal money.Amount `json:"loans_receivable_total"`
	LoansDefaultedTotal  money.Amount `json:"loans_defaulted_total"`
	// CreditCardDebt is what the user owes on credit cards, in DOP (USD debt
	// converted at UsdToDopRate). Net worth subtracts it.
	CreditCardDebt money.Amount `json:"credit_card_debt"`
	// NetWorth is accounts + investments + broker cash + certificates + loans
	// receivable - credit card debt, in DOP.
	NetWorth             money.Amount       `json:"net_worth"`
	CreditCardsCount     int                `json:"credit_cards_count"`
	AccountsCount        int                `json:"accounts_count"`
	InvestmentsCount     int                `json:"investments_count"`
	CertificatesCount    int                `json:"certificates_count"`
	LoansReceivableCount int                `json:"loans_receivable_count"`
	CategoryExpenses     []*CategoryExpense `json:"category_expenses"`
	MonthlySummary       []*MonthlySummary  `json:"monthly_summary"`
}
