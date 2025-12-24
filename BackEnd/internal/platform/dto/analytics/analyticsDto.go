package analyticsdto

import "github.com/osmait/gestorDePresupuesto/internal/domain/analytics"

type GetCategoryExpensesResponse struct {
	ID    string  `json:"id"`
	Label string  `json:"label"`
	Value float64 `json:"value"`
	Color string  `json:"color"`
}

func NewGetCategoryExpensesResponse(categoryExpenses []*analytics.CategoryExpense) []GetCategoryExpensesResponse {
	var response []GetCategoryExpensesResponse
	for _, categoryExpense := range categoryExpenses {
		response = append(response, GetCategoryExpensesResponse{
			ID:    categoryExpense.ID,
			Label: categoryExpense.Label,
			Value: categoryExpense.Value,
			Color: categoryExpense.Color,
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
	var response []GetMonthlySummaryResponse
	for _, monthlySummary := range monthlySummaries {
		response = append(response, GetMonthlySummaryResponse{
			Month:    monthlySummary.Month,
			Ingresos: monthlySummary.Income,
			Gastos:   monthlySummary.Expenses,
		})
	}
	return response
}
