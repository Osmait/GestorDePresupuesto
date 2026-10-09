package dto

import (
	"math"

	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
)

// PaginatedTransactionResponse represents a paginated response for transactions
type PaginatedTransactionResponse struct {
	Data       []*TransactionResponse `json:"data"`
	Pagination PaginationMeta         `json:"pagination"`
}

// PaginationMeta contains metadata about the pagination
type PaginationMeta struct {
	CurrentPage  int   `json:"current_page" example:"1"`
	PerPage      int   `json:"per_page" example:"20"`
	TotalPages   int   `json:"total_pages" example:"5"`
	TotalRecords int64 `json:"total_records" example:"100"`
	HasNextPage  bool  `json:"has_next_page" example:"true"`
	HasPrevPage  bool  `json:"has_prev_page" example:"false"`
	NextPage     *int  `json:"next_page,omitempty" example:"2"`
	PrevPage     *int  `json:"prev_page,omitempty" example:"1"`
}

// NewPaginatedTransactionResponse creates a new paginated response with metadata
func NewPaginatedTransactionResponse(
	transactions []*TransactionResponse,
	filter *TransactionFilter,
	totalRecords int64,
) *PaginatedTransactionResponse {
	// Calculate pagination metadata
	totalPages := int(math.Ceil(float64(totalRecords) / float64(filter.Limit)))
	hasNextPage := filter.Page < totalPages
	hasPrevPage := filter.Page > 1

	var nextPage *int
	var prevPage *int

	if hasNextPage {
		next := filter.Page + 1
		nextPage = &next
	}

	if hasPrevPage {
		prev := filter.Page - 1
		prevPage = &prev
	}

	return &PaginatedTransactionResponse{
		Data: transactions,
		Pagination: PaginationMeta{
			CurrentPage:  filter.Page,
			PerPage:      filter.Limit,
			TotalPages:   totalPages,
			TotalRecords: totalRecords,
			HasNextPage:  hasNextPage,
			HasPrevPage:  hasPrevPage,
			NextPage:     nextPage,
			PrevPage:     prevPage,
		},
	}
}

// TransactionSummary provides aggregated data for transactions
type TransactionSummary struct {
	TotalIncome       money.Amount               `json:"total_income" example:"5000.00"`
	TotalExpenses     money.Amount               `json:"total_expenses" example:"3000.00"`
	NetAmount         money.Amount               `json:"net_amount" example:"2000.00"`
	IncomeDOP         money.Amount               `json:"income_dop" example:"4500.00"`
	IncomeUSD         money.Amount               `json:"income_usd" example:"10.00"`
	ExpensesDOP       money.Amount               `json:"expenses_dop" example:"2800.00"`
	ExpensesUSD       money.Amount               `json:"expenses_usd" example:"5.00"`
	UsdToDopRate      money.Amount               `json:"usd_to_dop_rate" example:"60.00"`
	IncomeCount       int                        `json:"income_count" example:"15"`
	ExpenseCount      int                        `json:"expense_count" example:"35"`
	AverageIncome     money.Amount               `json:"average_income" example:"333.33"`
	AverageExpense    money.Amount               `json:"average_expense" example:"85.71"`
	LargestIncome     money.Amount               `json:"largest_income" example:"2500.00"`
	LargestExpense    money.Amount               `json:"largest_expense" example:"800.00"`
	FilteredRecords   int64                      `json:"filtered_records" example:"50"`
	CategoryBreakdown map[string]CategorySummary `json:"category_breakdown,omitempty"`
}

// CategorySummary provides summary for each category
type CategorySummary struct {
	CategoryId    string       `json:"category_id" example:"cat_123456789"`
	TotalAmount   money.Amount `json:"total_amount" example:"500.00"`
	Count         int          `json:"count" example:"10"`
	AverageAmount money.Amount `json:"average_amount" example:"50.00"`
}

// PaginatedTransactionResponseWithSummary extends the paginated response with summary data
type PaginatedTransactionResponseWithSummary struct {
	Data       []*TransactionResponse `json:"data"`
	Pagination PaginationMeta         `json:"pagination"`
	Summary    TransactionSummary     `json:"summary"`
}

// NewPaginatedTransactionResponseWithSummary creates a paginated response with summary
func NewPaginatedTransactionResponseWithSummary(
	transactions []*TransactionResponse,
	filter *TransactionFilter,
	totalRecords int64,
	summary TransactionSummary,
) *PaginatedTransactionResponseWithSummary {
	paginatedResponse := NewPaginatedTransactionResponse(transactions, filter, totalRecords)

	return &PaginatedTransactionResponseWithSummary{
		Data:       paginatedResponse.Data,
		Pagination: paginatedResponse.Pagination,
		Summary:    summary,
	}
}

// DefaultUsdToDopRate is used when no exchange rate is available.
var DefaultUsdToDopRate = money.FromInt(60)

// CalculateSummary calculates summary statistics from a list of transactions.
//
// USD amounts are converted exactly (amount * rate) and accumulated without
// intermediate rounding; totals, averages and the largest values are rounded
// half-even to cents once, at the end.
func CalculateSummary(transactions []*TransactionResponse, filteredCount int64, usdToDopRate money.Amount) TransactionSummary {
	if !usdToDopRate.IsPositive() {
		usdToDopRate = DefaultUsdToDopRate
	}

	summary := TransactionSummary{
		FilteredRecords:   filteredCount,
		CategoryBreakdown: make(map[string]CategorySummary),
		UsdToDopRate:      usdToDopRate,
	}

	if len(transactions) == 0 {
		return summary
	}

	categoryTotals := make(map[string]money.Amount)
	categoryCounts := make(map[string]int)

	for _, transaction := range transactions {
		amountAbs := transaction.Amount
		currency := transaction.Currency
		if currency == "" {
			currency = "DOP"
		}

		amountDOP := amountAbs
		if currency == "USD" {
			amountDOP = amountAbs.Mul(usdToDopRate)
		}

		switch transaction.TypeTransation {
		case "income":
			summary.TotalIncome = summary.TotalIncome.Add(amountDOP)
			if currency == "USD" {
				summary.IncomeUSD = summary.IncomeUSD.Add(amountAbs)
			} else {
				summary.IncomeDOP = summary.IncomeDOP.Add(amountAbs)
			}
			summary.IncomeCount++

			if amountDOP.GreaterThan(summary.LargestIncome) {
				summary.LargestIncome = amountDOP
			}
		case "bill", "expense":
			summary.TotalExpenses = summary.TotalExpenses.Add(amountDOP)
			if currency == "USD" {
				summary.ExpensesUSD = summary.ExpensesUSD.Add(amountAbs)
			} else {
				summary.ExpensesDOP = summary.ExpensesDOP.Add(amountAbs)
			}
			summary.ExpenseCount++

			if amountDOP.GreaterThan(summary.LargestExpense) {
				summary.LargestExpense = amountDOP
			}
		}

		// Category breakdown
		if transaction.CategoryId != "" {
			categoryTotals[transaction.CategoryId] = categoryTotals[transaction.CategoryId].Add(amountDOP)
			categoryCounts[transaction.CategoryId]++
		}
	}

	// Calculate derived values
	summary.NetAmount = summary.TotalIncome.Sub(summary.TotalExpenses).RoundCents()

	if summary.IncomeCount > 0 {
		summary.AverageIncome = summary.TotalIncome.DivInt(int64(summary.IncomeCount)).RoundCents()
	}

	if summary.ExpenseCount > 0 {
		summary.AverageExpense = summary.TotalExpenses.DivInt(int64(summary.ExpenseCount)).RoundCents()
	}

	summary.TotalIncome = summary.TotalIncome.RoundCents()
	summary.TotalExpenses = summary.TotalExpenses.RoundCents()
	summary.LargestIncome = summary.LargestIncome.RoundCents()
	summary.LargestExpense = summary.LargestExpense.RoundCents()

	// Build category breakdown
	for categoryId, total := range categoryTotals {
		count := categoryCounts[categoryId]
		average := total.DivInt(int64(count)).RoundCents()

		summary.CategoryBreakdown[categoryId] = CategorySummary{
			CategoryId:    categoryId,
			TotalAmount:   total.RoundCents(),
			Count:         count,
			AverageAmount: average,
		}
	}

	return summary
}
