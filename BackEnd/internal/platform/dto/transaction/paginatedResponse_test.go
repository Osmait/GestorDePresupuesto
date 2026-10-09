package dto

import (
	"testing"
	"time"

	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money/moneytest"
	"github.com/stretchr/testify/assert"
)

func TestNewPaginatedTransactionResponse(t *testing.T) {
	// Create sample transactions
	transactions := []*TransactionResponse{
		{
			Id:             "1",
			Name:           "Grocery",
			Amount:         money.FromInt(100),
			TypeTransation: "expense",
			AccountId:      "acc_1",
			CategoryId:     "cat_1",
			CreatedAt:      time.Now(),
		},
		{
			Id:             "2",
			Name:           "Salary",
			Amount:         money.FromInt(2000),
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
			Amount:         money.FromInt(100),
			TypeTransation: "expense",
			CategoryId:     "cat_food",
		},
		{
			Id:             "2",
			Name:           "Restaurant",
			Amount:         money.FromInt(50),
			TypeTransation: "expense",
			CategoryId:     "cat_food",
		},
		{
			Id:             "3",
			Name:           "Salary",
			Amount:         money.FromInt(2000),
			TypeTransation: "income",
			CategoryId:     "cat_salary",
		},
		{
			Id:             "4",
			Name:           "Freelance",
			Amount:         money.FromInt(500),
			TypeTransation: "income",
			CategoryId:     "cat_freelance",
		},
		{
			Id:             "5",
			Name:           "Gas",
			Amount:         money.FromInt(75),
			TypeTransation: "expense",
			CategoryId:     "cat_transport",
		},
	}

	filteredCount := int64(10)
	summary := CalculateSummary(transactions, filteredCount, money.FromInt(60))

	// Test totals
	moneytest.Equal(t, 2500.0, summary.TotalIncome)  // 2000 + 500
	moneytest.Equal(t, 225.0, summary.TotalExpenses) // 100 + 50 + 75
	moneytest.Equal(t, 2275.0, summary.NetAmount)    // 2500 - 225

	// Test counts
	assert.Equal(t, 2, summary.IncomeCount)
	assert.Equal(t, 3, summary.ExpenseCount)
	assert.Equal(t, filteredCount, summary.FilteredRecords)

	// Test averages
	moneytest.Equal(t, 1250.0, summary.AverageIncome) // 2500 / 2
	moneytest.Equal(t, 75.0, summary.AverageExpense)  // 225 / 3

	// Test largest amounts
	moneytest.Equal(t, 2000.0, summary.LargestIncome)
	moneytest.Equal(t, 100.0, summary.LargestExpense)

	// Test category breakdown
	assert.Len(t, summary.CategoryBreakdown, 4)

	// Check food category (2 transactions)
	foodCategory := summary.CategoryBreakdown["cat_food"]
	assert.Equal(t, "cat_food", foodCategory.CategoryId)
	moneytest.Equal(t, 150.0, foodCategory.TotalAmount) // 100 + 50
	assert.Equal(t, 2, foodCategory.Count)
	moneytest.Equal(t, 75.0, foodCategory.AverageAmount) // 150 / 2

	// Check salary category (1 transaction)
	salaryCategory := summary.CategoryBreakdown["cat_salary"]
	assert.Equal(t, "cat_salary", salaryCategory.CategoryId)
	moneytest.Equal(t, 2000.0, salaryCategory.TotalAmount)
	assert.Equal(t, 1, salaryCategory.Count)
	moneytest.Equal(t, 2000.0, salaryCategory.AverageAmount)
}

func TestCalculateSummary_EmptyTransactions(t *testing.T) {
	transactions := []*TransactionResponse{}
	filteredCount := int64(0)

	summary := CalculateSummary(transactions, filteredCount, money.FromInt(60))

	moneytest.Equal(t, 0.0, summary.TotalIncome)
	moneytest.Equal(t, 0.0, summary.TotalExpenses)
	moneytest.Equal(t, 0.0, summary.NetAmount)
	assert.Equal(t, 0, summary.IncomeCount)
	assert.Equal(t, 0, summary.ExpenseCount)
	moneytest.Equal(t, 0.0, summary.AverageIncome)
	moneytest.Equal(t, 0.0, summary.AverageExpense)
	moneytest.Equal(t, 0.0, summary.LargestIncome)
	moneytest.Equal(t, 0.0, summary.LargestExpense)
	assert.Equal(t, filteredCount, summary.FilteredRecords)
	assert.Empty(t, summary.CategoryBreakdown)
}

func TestNewPaginatedTransactionResponseWithSummary(t *testing.T) {
	transactions := []*TransactionResponse{
		{
			Id:             "1",
			Amount:         money.FromInt(100),
			TypeTransation: "expense",
		},
	}

	filter := &TransactionFilter{
		Page:  1,
		Limit: 10,
	}

	totalRecords := int64(1)
	summary := TransactionSummary{
		TotalIncome:   money.Zero,
		TotalExpenses: money.FromInt(100),
		NetAmount:     money.FromInt(-100),
		ExpenseCount:  1,
	}

	response := NewPaginatedTransactionResponseWithSummary(transactions, filter, totalRecords, summary)

	assert.NotNil(t, response)
	assert.Equal(t, transactions, response.Data)
	assert.Equal(t, summary, response.Summary)
	assert.Equal(t, 1, response.Pagination.CurrentPage)
	assert.Equal(t, totalRecords, response.Pagination.TotalRecords)
}

// TestCalculateSummary_DecimalPrecisionAndRounding covers the analytics
// rounding policy: totals are exact sums, USD is converted exactly, and
// averages are divided in decimal and rounded half-even to cents once.
func TestCalculateSummary_DecimalPrecisionAndRounding(t *testing.T) {
	t.Parallel()

	var txs []*TransactionResponse
	// Ten incomes of 0.10: float64 would sum to 0.9999999999999999.
	for i := 0; i < 10; i++ {
		txs = append(txs, &TransactionResponse{Amount: money.MustParse("0.10"), TypeTransation: "income", CategoryId: "salary", Currency: "DOP"})
	}
	// A large income plus a cent stays exact.
	txs = append(txs, &TransactionResponse{Amount: money.MustParse("1000000000.01"), TypeTransation: "income", Currency: "DOP"})
	// Expenses whose average is not representable: (10 + 10 + 10.01) / 3 = 10.00333...
	txs = append(txs,
		&TransactionResponse{Amount: money.FromInt(10), TypeTransation: "bill", CategoryId: "food", Currency: "DOP"},
		&TransactionResponse{Amount: money.FromInt(10), TypeTransation: "bill", CategoryId: "food", Currency: "DOP"},
		&TransactionResponse{Amount: money.MustParse("10.01"), TypeTransation: "bill", CategoryId: "food", Currency: "DOP"},
		// 0.07 USD at 58.75 = 4.1125 DOP: kept exact in the total, rounded only at the end.
		&TransactionResponse{Amount: money.MustParse("0.07"), TypeTransation: "bill", CategoryId: "fx", Currency: "USD"},
	)

	summary := CalculateSummary(txs, int64(len(txs)), money.MustParse("58.75"))

	moneytest.Equal(t, "1000000001.01", summary.TotalIncome)
	moneytest.Equal(t, "1000000001.01", summary.IncomeDOP)
	// 30.01 + 4.1125 = 34.1225 -> 34.12 (half-even)
	moneytest.Equal(t, "34.12", summary.TotalExpenses)
	moneytest.Equal(t, "30.01", summary.ExpensesDOP)
	moneytest.Equal(t, "0.07", summary.ExpensesUSD)
	// (1000000001.01 - 34.1225) = 999999966.8875 -> 999999966.89
	moneytest.Equal(t, "999999966.89", summary.NetAmount)
	// 1000000001.01 / 11 = 90909091.000909... -> 90909091.00
	moneytest.Equal(t, "90909091.00", summary.AverageIncome)
	// 34.1225 / 4 = 8.530625 -> 8.53
	moneytest.Equal(t, "8.53", summary.AverageExpense)
	moneytest.Equal(t, "1000000000.01", summary.LargestIncome)

	moneytest.Equal(t, "1.00", summary.CategoryBreakdown["salary"].TotalAmount)
	moneytest.Equal(t, "0.10", summary.CategoryBreakdown["salary"].AverageAmount)
	moneytest.Equal(t, "30.01", summary.CategoryBreakdown["food"].TotalAmount)
	moneytest.Equal(t, "10.00", summary.CategoryBreakdown["food"].AverageAmount)
	moneytest.Equal(t, "4.11", summary.CategoryBreakdown["fx"].TotalAmount)
}
