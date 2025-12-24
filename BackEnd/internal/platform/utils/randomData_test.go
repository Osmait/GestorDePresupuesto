package utils

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestGetNewRandomUser(t *testing.T) {
	user := GetNewRandomUser()

	assert.NotNil(t, user, "User should not be nil")
	assert.NotEmpty(t, user.Id, "User ID should not be empty")
	assert.NotEmpty(t, user.Name, "User name should not be empty")
	assert.NotEmpty(t, user.LastName, "User last name should not be empty")
	assert.NotEmpty(t, user.Email, "User email should not be empty")
	assert.NotEmpty(t, user.Password, "User password should not be empty")

	// Test that multiple calls generate different users
	user2 := GetNewRandomUser()
	assert.NotEqual(t, user.Id, user2.Id, "Different calls should generate different IDs")
	assert.NotEqual(t, user.Email, user2.Email, "Different calls should generate different emails")
}

func TestGetNewRandomAccount(t *testing.T) {
	account := GetNewRandomAccount()

	assert.NotNil(t, account, "Account should not be nil")
	assert.NotEmpty(t, account.Id, "Account ID should not be empty")
	assert.NotEmpty(t, account.Name, "Account name should not be empty")
	assert.NotEmpty(t, account.Bank, "Account bank should not be empty")
	assert.GreaterOrEqual(t, account.InitialBalance, 0.0, "Account balance should be non-negative")

	// Test that multiple calls generate different accounts
	account2 := GetNewRandomAccount()
	assert.NotEqual(t, account.Id, account2.Id, "Different calls should generate different IDs")
}

func TestGetNewRandomTransaction(t *testing.T) {
	transaction := GetNewRandomTransaction()

	assert.NotNil(t, transaction, "Transaction should not be nil")
	assert.NotEmpty(t, transaction.Id, "Transaction ID should not be empty")
	assert.NotEmpty(t, transaction.Name, "Transaction name should not be empty")
	assert.NotEmpty(t, transaction.Description, "Transaction description should not be empty")
	assert.NotEmpty(t, transaction.TypeTransation, "Transaction type should not be empty")
	assert.NotEmpty(t, transaction.AccountId, "Transaction account ID should not be empty")
	assert.NotEmpty(t, transaction.CategoryId, "Transaction category ID should not be empty")
	assert.NotZero(t, transaction.Amount, "Transaction amount should not be zero")

	// Verify transaction type is one of the expected values
	validTypes := []string{"bill", "income"}
	assert.Contains(t, validTypes, transaction.TypeTransation, "Transaction type should be either 'bill' or 'income'")

	// Test that multiple calls generate different transactions
	transaction2 := GetNewRandomTransaction()
	assert.NotEqual(t, transaction.Id, transaction2.Id, "Different calls should generate different IDs")
}

func TestGetNewRandomCategory(t *testing.T) {
	category := GetNewRandomCategory()

	assert.NotNil(t, category, "Category should not be nil")
	assert.NotEmpty(t, category.Id, "Category ID should not be empty")
	assert.NotEmpty(t, category.Name, "Category name should not be empty")
	assert.NotEmpty(t, category.Icon, "Category icon should not be empty")
	assert.NotEmpty(t, category.Color, "Category color should not be empty")

	// Test that multiple calls generate different categories
	category2 := GetNewRandomCategory()
	assert.NotEqual(t, category.Id, category2.Id, "Different calls should generate different IDs")
}

func TestGetNewRandomBudget(t *testing.T) {
	budget := GetNewRandomBudget()

	assert.NotNil(t, budget, "Budget should not be nil")
	assert.NotEmpty(t, budget.Id, "Budget ID should not be empty")
	assert.NotEmpty(t, budget.CategoryId, "Budget category ID should not be empty")
	assert.NotEmpty(t, budget.UserId, "Budget user ID should not be empty")
	assert.Greater(t, budget.Amount, 0.0, "Budget amount should be positive")

	// Test that multiple calls generate different budgets
	budget2 := GetNewRandomBudget()
	assert.NotEqual(t, budget.Id, budget2.Id, "Different calls should generate different IDs")
}

func TestGetNewRandomInvestment(t *testing.T) {
	investment := GetNewRandomInvestment()

	assert.NotNil(t, investment, "Investment should not be nil")
	assert.NotEmpty(t, investment.ID, "Investment ID should not be empty")
	assert.NotEmpty(t, investment.Name, "Investment name should not be empty")
	assert.NotEmpty(t, investment.UserID, "Investment user ID should not be empty")
	assert.Greater(t, investment.PurchasePrice, 0.0, "Investment price should be positive")
	assert.Greater(t, investment.CurrentPrice, 0.0, "Investment current price should be positive")
	assert.Greater(t, investment.Quantity, 0.0, "Investment quantity should be positive")

	// Test that multiple calls generate different investments
	investment2 := GetNewRandomInvestment()
	assert.NotEqual(t, investment.ID, investment2.ID, "Different calls should generate different IDs")
	assert.NotEqual(t, investment.UserID, investment2.UserID, "Different calls should generate different user IDs")
}

func TestRandomDataConsistency(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping consistency test in short mode")
	}

	// Test that all random generators produce valid, non-nil results consistently
	iterations := 10
	if testing.Short() {
		iterations = 3
	}

	for i := 0; i < iterations; i++ {
		user := GetNewRandomUser()
		account := GetNewRandomAccount()
		transaction := GetNewRandomTransaction()
		category := GetNewRandomCategory()
		budget := GetNewRandomBudget()
		investment := GetNewRandomInvestment()

		assert.NotNil(t, user, "User should always be non-nil")
		assert.NotNil(t, account, "Account should always be non-nil")
		assert.NotNil(t, transaction, "Transaction should always be non-nil")
		assert.NotNil(t, category, "Category should always be non-nil")
		assert.NotNil(t, budget, "Budget should always be non-nil")
		assert.NotNil(t, investment, "Investment should always be non-nil")

		assert.NotEmpty(t, user.Id, "User ID should always be non-empty")
		assert.NotEmpty(t, account.Id, "Account ID should always be non-empty")
		assert.NotEmpty(t, transaction.Id, "Transaction ID should always be non-empty")
		assert.NotEmpty(t, category.Id, "Category ID should always be non-empty")
		assert.NotEmpty(t, budget.Id, "Budget ID should always be non-empty")
		assert.NotEmpty(t, investment.ID, "Investment ID should always be non-empty")
	}
}

func TestTransactionTypeDistribution(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping distribution test in short mode")
	}

	// Test that transaction types are properly distributed
	typeCount := make(map[string]int)
	iterations := 50 // Reduced from 100 for faster execution

	for i := 0; i < iterations; i++ {
		transaction := GetNewRandomTransaction()
		typeCount[transaction.TypeTransation]++
	}

	// Should have both types represented
	assert.Greater(t, typeCount["bill"], 0, "Should generate some 'bill' transactions")
	assert.Greater(t, typeCount["income"], 0, "Should generate some 'income' transactions")
	assert.Equal(t, iterations, typeCount["bill"]+typeCount["income"], "Total should equal iterations")
}
