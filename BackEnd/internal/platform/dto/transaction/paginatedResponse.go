package dto

import "math"

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
	TotalIncome       float64                    `json:"total_income" example:"5000.00"`
	TotalExpenses     float64                    `json:"total_expenses" example:"3000.00"`
	NetAmount         float64                    `json:"net_amount" example:"2000.00"`
	IncomeCount       int                        `json:"income_count" example:"15"`
	ExpenseCount      int                        `json:"expense_count" example:"35"`
	AverageIncome     float64                    `json:"average_income" example:"333.33"`
	AverageExpense    float64                    `json:"average_expense" example:"85.71"`
	LargestIncome     float64                    `json:"largest_income" example:"2500.00"`
	LargestExpense    float64                    `json:"largest_expense" example:"800.00"`
	FilteredRecords   int64                      `json:"filtered_records" example:"50"`
	CategoryBreakdown map[string]CategorySummary `json:"category_breakdown,omitempty"`
}

// CategorySummary provides summary for each category
type CategorySummary struct {
	CategoryId    string  `json:"category_id" example:"cat_123456789"`
	TotalAmount   float64 `json:"total_amount" example:"500.00"`
	Count         int     `json:"count" example:"10"`
	AverageAmount float64 `json:"average_amount" example:"50.00"`
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

// CalculateSummary calculates summary statistics from a list of transactions
func CalculateSummary(transactions []*TransactionResponse, filteredCount int64) TransactionSummary {
	summary := TransactionSummary{
		FilteredRecords:   filteredCount,
		CategoryBreakdown: make(map[string]CategorySummary),
	}

	if len(transactions) == 0 {
		return summary
	}

	categoryTotals := make(map[string]float64)
	categoryCounts := make(map[string]int)

	for _, transaction := range transactions {
		amount := transaction.Amount

		switch transaction.TypeTransation {
		case "income":
			summary.TotalIncome += amount
			summary.IncomeCount++

			if amount > summary.LargestIncome {
				summary.LargestIncome = amount
			}
		case "expense":
			summary.TotalExpenses += amount
			summary.ExpenseCount++

			if amount > summary.LargestExpense {
				summary.LargestExpense = amount
			}
		}

		// Category breakdown
		if transaction.CategoryId != "" {
			categoryTotals[transaction.CategoryId] += amount
			categoryCounts[transaction.CategoryId]++
		}
	}

	// Calculate derived values
	summary.NetAmount = summary.TotalIncome - summary.TotalExpenses

	if summary.IncomeCount > 0 {
		summary.AverageIncome = summary.TotalIncome / float64(summary.IncomeCount)
	}

	if summary.ExpenseCount > 0 {
		summary.AverageExpense = summary.TotalExpenses / float64(summary.ExpenseCount)
	}

	// Build category breakdown
	for categoryId, total := range categoryTotals {
		count := categoryCounts[categoryId]
		average := total / float64(count)

		summary.CategoryBreakdown[categoryId] = CategorySummary{
			CategoryId:    categoryId,
			TotalAmount:   total,
			Count:         count,
			AverageAmount: average,
		}
	}

	return summary
}
