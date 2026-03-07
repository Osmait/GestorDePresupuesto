package analyticsdto

import "github.com/osmait/gestorDePresupuesto/internal/domain/analytics"

type GetCategoryExpensesResponse struct {
	ID               string  `json:"id"`
	Label            string  `json:"label"`
	Value            float64 `json:"value"`
	Color            string  `json:"color"`
	TransactionCount int     `json:"transaction_count"`
	DopTotal         float64 `json:"dop_total"`
	UsdTotal         float64 `json:"usd_total"`
}

func NewGetCategoryExpensesResponse(categoryExpenses []*analytics.CategoryExpense) []GetCategoryExpensesResponse {
	response := make([]GetCategoryExpensesResponse, 0)
	for _, categoryExpense := range categoryExpenses {
		response = append(response, GetCategoryExpensesResponse{
			ID:               categoryExpense.ID,
			Label:            categoryExpense.Label,
			Value:            categoryExpense.Value,
			Color:            categoryExpense.Color,
			TransactionCount: categoryExpense.TransactionCount,
			DopTotal:         categoryExpense.DopTotal,
			UsdTotal:         categoryExpense.UsdTotal,
		})
	}
	return response
}

type GetMonthlySummaryResponse struct {
	Month    string  `json:"month"`
	Ingresos float64 `json:"Ingresos"`
	Gastos   float64 `json:"Gastos"`
}

func NewGetMonthlySummaryResponse(monthlySummaries []*analytics.MonthlySummary) []GetMonthlySummaryResponse {
	response := make([]GetMonthlySummaryResponse, 0)
	for _, monthlySummary := range monthlySummaries {
		response = append(response, GetMonthlySummaryResponse{
			Month:    monthlySummary.Month,
			Ingresos: monthlySummary.Income,
			Gastos:   monthlySummary.Expenses,
		})
	}
	return response
}

type DashboardSummaryResponse struct {
	TotalIncome       float64                       `json:"total_income"`
	TotalExpenses     float64                       `json:"total_expenses"`
	NetAmount         float64                       `json:"net_amount"`
	UsdToDopRate      float64                       `json:"usd_to_dop_rate"`
	AccountsTotal     float64                       `json:"accounts_total"`
	InvestmentsTotal  float64                       `json:"investments_total"`
	CertificatesTotal float64                       `json:"certificates_total"`
	AccountsCount     int                           `json:"accounts_count"`
	InvestmentsCount  int                           `json:"investments_count"`
	CertificatesCount int                           `json:"certificates_count"`
	CategoryExpenses  []GetCategoryExpensesResponse `json:"category_expenses"`
	MonthlySummary    []GetMonthlySummaryResponse   `json:"monthly_summary"`
}

func NewDashboardSummaryResponse(summary *analytics.DashboardSummary) DashboardSummaryResponse {
	if summary == nil {
		return DashboardSummaryResponse{
			CategoryExpenses: make([]GetCategoryExpensesResponse, 0),
			MonthlySummary:   make([]GetMonthlySummaryResponse, 0),
		}
	}

	return DashboardSummaryResponse{
		TotalIncome:       summary.TotalIncome,
		TotalExpenses:     summary.TotalExpenses,
		NetAmount:         summary.NetAmount,
		UsdToDopRate:      summary.UsdToDopRate,
		AccountsTotal:     summary.AccountsTotal,
		InvestmentsTotal:  summary.InvestmentsTotal,
		CertificatesTotal: summary.CertificatesTotal,
		AccountsCount:     summary.AccountsCount,
		InvestmentsCount:  summary.InvestmentsCount,
		CertificatesCount: summary.CertificatesCount,
		CategoryExpenses:  NewGetCategoryExpensesResponse(summary.CategoryExpenses),
		MonthlySummary:    NewGetMonthlySummaryResponse(summary.MonthlySummary),
	}
}
