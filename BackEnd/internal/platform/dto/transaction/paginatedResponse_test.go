package dto

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestNewPaginatedTransactionResponse(t *testing.T) {
	// Create sample transactions
	transactions := []*TransactionResponse{
		{
			Id:             "1",
			Name:           "Grocery",
			Amount:         100.0,
			TypeTransation: "expense",
			AccountId:      "acc_1",
			CategoryId:     "cat_1",
			CreatedAt:      time.Now(),
		},
		{
			Id:             "2",
			Name:           "Salary",
			Amount:         2000.0,
			TypeTransation: "income",
			AccountId:      "acc_1",
			CategoryId:     "cat_2",
			CreatedAt:      time.Now(),
		},
	}

	// Create filter
	filter := &TransactionFilter{
		Page:  2,
		Limit: 10,
	}

	totalRecords := int64(25)

	// Create paginated response
	response := NewPaginatedTransactionResponse(transactions, filter, totalRecords)

	// Assertions
	assert.NotNil(t, response)
	assert.Equal(t, transactions, response.Data)
	assert.Equal(t, 2, response.Pagination.CurrentPage)
	assert.Equal(t, 10, response.Pagination.PerPage)
	assert.Equal(t, 3, response.Pagination.TotalPages) // ceil(25/10)
	assert.Equal(t, totalRecords, response.Pagination.TotalRecords)
	assert.True(t, response.Pagination.HasNextPage)
	assert.True(t, response.Pagination.HasPrevPage)
	assert.NotNil(t, response.Pagination.NextPage)
	assert.Equal(t, 3, *response.Pagination.NextPage)
	assert.NotNil(t, response.Pagination.PrevPage)
	assert.Equal(t, 1, *response.Pagination.PrevPage)
}

func TestNewPaginatedTransactionResponse_FirstPage(t *testing.T) {
	transactions := []*TransactionResponse{}
	filter := &TransactionFilter{
		Page:  1,
		Limit: 10,
	}
	totalRecords := int64(25)

	response := NewPaginatedTransactionResponse(transactions, filter, totalRecords)

	assert.Equal(t, 1, response.Pagination.CurrentPage)
	assert.False(t, response.Pagination.HasPrevPage)
	assert.True(t, response.Pagination.HasNextPage)
	assert.Nil(t, response.Pagination.PrevPage)
	assert.NotNil(t, response.Pagination.NextPage)
	assert.Equal(t, 2, *response.Pagination.NextPage)
}

func TestNewPaginatedTransactionResponse_LastPage(t *testing.T) {
	transactions := []*TransactionResponse{}
	filter := &TransactionFilter{
		Page:  3,
		Limit: 10,
	}
	totalRecords := int64(25) // 3 pages total

	response := NewPaginatedTransactionResponse(transactions, filter, totalRecords)

	assert.Equal(t, 3, response.Pagination.CurrentPage)
	assert.True(t, response.Pagination.HasPrevPage)
	assert.False(t, response.Pagination.HasNextPage)
	assert.NotNil(t, response.Pagination.PrevPage)
	assert.Equal(t, 2, *response.Pagination.PrevPage)
	assert.Nil(t, response.Pagination.NextPage)
}

func TestNewPaginatedTransactionResponse_SinglePage(t *testing.T) {
	transactions := []*TransactionResponse{}
	filter := &TransactionFilter{
		Page:  1,
		Limit: 10,
	}
	totalRecords := int64(5) // Less than limit

	response := NewPaginatedTransactionResponse(transactions, filter, totalRecords)

	assert.Equal(t, 1, response.Pagination.TotalPages)
	assert.False(t, response.Pagination.HasPrevPage)
	assert.False(t, response.Pagination.HasNextPage)
	assert.Nil(t, response.Pagination.PrevPage)
	assert.Nil(t, response.Pagination.NextPage)
}

func TestCalculateSummary(t *testing.T) {
	transactions := []*TransactionResponse{
		{
			Id:             "1",
			Name:           "Grocery",
			Amount:         100.0,
			TypeTransation: "expense",
			CategoryId:     "cat_food",
		},
		{
			Id:             "2",
			Name:           "Restaurant",
			Amount:         50.0,
			TypeTransation: "expense",
			CategoryId:     "cat_food",
		},
		{
			Id:             "3",
			Name:           "Salary",
			Amount:         2000.0,
			TypeTransation: "income",
			CategoryId:     "cat_salary",
		},
		{
			Id:             "4",
			Name:           "Freelance",
			Amount:         500.0,
			TypeTransation: "income",
			CategoryId:     "cat_freelance",
		},
		{
			Id:             "5",
			Name:           "Gas",
			Amount:         75.0,
			TypeTransation: "expense",
			CategoryId:     "cat_transport",
		},
	}

	filteredCount := int64(10)
	summary := CalculateSummary(transactions, filteredCount)

	// Test totals
	assert.Equal(t, 2500.0, summary.TotalIncome)  // 2000 + 500
	assert.Equal(t, 225.0, summary.TotalExpenses) // 100 + 50 + 75
	assert.Equal(t, 2275.0, summary.NetAmount)    // 2500 - 225

	// Test counts
	assert.Equal(t, 2, summary.IncomeCount)
	assert.Equal(t, 3, summary.ExpenseCount)
	assert.Equal(t, filteredCount, summary.FilteredRecords)

	// Test averages
	assert.Equal(t, 1250.0, summary.AverageIncome) // 2500 / 2
	assert.Equal(t, 75.0, summary.AverageExpense)  // 225 / 3

	// Test largest amounts
	assert.Equal(t, 2000.0, summary.LargestIncome)
	assert.Equal(t, 100.0, summary.LargestExpense)

	// Test category breakdown
	assert.Len(t, summary.CategoryBreakdown, 4)

	// Check food category (2 transactions)
	foodCategory := summary.CategoryBreakdown["cat_food"]
	assert.Equal(t, "cat_food", foodCategory.CategoryId)
	assert.Equal(t, 150.0, foodCategory.TotalAmount) // 100 + 50
	assert.Equal(t, 2, foodCategory.Count)
	assert.Equal(t, 75.0, foodCategory.AverageAmount) // 150 / 2

	// Check salary category (1 transaction)
	salaryCategory := summary.CategoryBreakdown["cat_salary"]
	assert.Equal(t, "cat_salary", salaryCategory.CategoryId)
	assert.Equal(t, 2000.0, salaryCategory.TotalAmount)
	assert.Equal(t, 1, salaryCategory.Count)
	assert.Equal(t, 2000.0, salaryCategory.AverageAmount)
}

func TestCalculateSummary_EmptyTransactions(t *testing.T) {
	transactions := []*TransactionResponse{}
	filteredCount := int64(0)

	summary := CalculateSummary(transactions, filteredCount)

	assert.Equal(t, 0.0, summary.TotalIncome)
	assert.Equal(t, 0.0, summary.TotalExpenses)
	assert.Equal(t, 0.0, summary.NetAmount)
	assert.Equal(t, 0, summary.IncomeCount)
	assert.Equal(t, 0, summary.ExpenseCount)
	assert.Equal(t, 0.0, summary.AverageIncome)
	assert.Equal(t, 0.0, summary.AverageExpense)
	assert.Equal(t, 0.0, summary.LargestIncome)
	assert.Equal(t, 0.0, summary.LargestExpense)
	assert.Equal(t, filteredCount, summary.FilteredRecords)
	assert.Empty(t, summary.CategoryBreakdown)
}

func TestNewPaginatedTransactionResponseWithSummary(t *testing.T) {
	transactions := []*TransactionResponse{
		{
			Id:             "1",
			Amount:         100.0,
			TypeTransation: "expense",
		},
	}

	filter := &TransactionFilter{
		Page:  1,
		Limit: 10,
	}

	totalRecords := int64(1)
	summary := TransactionSummary{
		TotalIncome:   0.0,
		TotalExpenses: 100.0,
		NetAmount:     -100.0,
		ExpenseCount:  1,
	}

	response := NewPaginatedTransactionResponseWithSummary(transactions, filter, totalRecords, summary)

	assert.NotNil(t, response)
	assert.Equal(t, transactions, response.Data)
	assert.Equal(t, summary, response.Summary)
	assert.Equal(t, 1, response.Pagination.CurrentPage)
	assert.Equal(t, totalRecords, response.Pagination.TotalRecords)
}
