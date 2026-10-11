//go:build e2e
// +build e2e

package e2e

import (
	"fmt"
	"net/http"
)

// TestCompleteUserFlow tests the complete user journey from registration to financial management
func (suite *E2ETestSuite) TestCompleteUserFlow() {
	suite.Run("CompleteUserJourney", func() {
		// 1. User Registration
		userData := suite.helpers.CreateTestUser("complete")

		resp := suite.helpers.MakeRequest("POST", "/user", userData, "")
		suite.Equal(http.StatusOK, resp.StatusCode, "User registration should succeed")

		// Verify user was created in database
		userCount := suite.helpers.CountRecords("users")
		suite.Equal(1, userCount, "Should have exactly one user in database")

		// 2. User Login
		loginData := map[string]string{
			"email":    userData.Email,
			"password": userData.Password,
		}

		resp = suite.helpers.MakeRequest("POST", "/login", loginData, "")
		suite.Equal(http.StatusOK, resp.StatusCode, "Login should succeed")

		token := resp.AsString()
		suite.NotEmpty(token, "Should receive JWT token")

		// Remove quotes from token if present
		if len(token) > 2 && token[0] == '"' && token[len(token)-1] == '"' {
			token = token[1 : len(token)-1]
		}

		// 3. Get User Profile
		resp = suite.helpers.MakeRequest("GET", "/profile", nil, token)
		suite.Equal(http.StatusOK, resp.StatusCode, "Should get user profile")

		var profile map[string]interface{}
		err := resp.AsJSON(&profile)
		suite.NoError(err, "Should parse profile response")
		suite.Equal(userData.Name, profile["name"], "Profile name should match")
		suite.Equal(userData.LastName, profile["last_name"], "Profile last name should match")
		suite.Equal(userData.Email, profile["email"], "Profile email should match")

		userID := profile["id"].(string)
		suite.NotEmpty(userID, "Should have user ID")

		// 4. Create First Account
		accountData := suite.helpers.CreateTestAccount("main")
		accountData.InitialBalance = 5000.0

		resp = suite.helpers.MakeRequest("POST", "/account", accountData, token)
		suite.Equal(http.StatusCreated, resp.StatusCode, "Account creation should succeed")

		// Verify account was created
		resp = suite.helpers.MakeRequest("GET", "/account", nil, token)
		suite.Equal(http.StatusOK, resp.StatusCode, "Should get accounts list")

		var accounts []map[string]interface{}
		err = resp.AsJSON(&accounts)
		suite.NoError(err, "Should parse accounts response")
		suite.Len(accounts, 1, "Should have exactly one account")

		account := accounts[0]
		accountInfo := account["account_info"].(map[string]interface{})
		suite.Equal(accountData.Name, accountInfo["name"], "Account name should match")
		suite.Equal(accountData.Bank, accountInfo["bank"], "Account bank should match")
		suite.Equal(accountData.InitialBalance, account["current_balance"], "Account balance should match initial balance")

		accountID := accountInfo["id"].(string)
		suite.NotEmpty(accountID, "Should have account ID")

		// 5. Create Multiple Categories
		categories := []string{"Alimentación", "Transporte", "Entretenimiento", "Salud"}
		categoryIDs := make([]string, 0, len(categories))

		for _, catName := range categories {
			categoryData := &struct {
				Name  string `json:"name"`
				Icon  string `json:"icon"`
				Color string `json:"color"`
			}{
				Name:  catName,
				Icon:  "🏷️",
				Color: "#" + fmt.Sprintf("%06X", len(catName)*123456%16777215), // Generate color based on name
			}

			resp = suite.helpers.MakeRequest("POST", "/category", categoryData, token)
			suite.Equal(http.StatusCreated, resp.StatusCode, "Category creation should succeed for %s", catName)
		}

		// Get all categories
		resp = suite.helpers.MakeRequest("GET", "/category", nil, token)
		suite.Equal(http.StatusOK, resp.StatusCode, "Should get categories list")

		var createdCategories []map[string]interface{}
		err = resp.AsJSON(&createdCategories)
		suite.NoError(err, "Should parse categories response")
		suite.Len(createdCategories, len(categories), "Should have all created categories")

		for _, cat := range createdCategories {
			categoryIDs = append(categoryIDs, cat["id"].(string))
		}

		// 6. Create Budgets for Categories
		budgetAmounts := []float64{800.0, 300.0, 200.0, 150.0}
		budgetIDs := make([]string, 0, len(categoryIDs))

		for i, categoryID := range categoryIDs {
			budgetData := suite.helpers.CreateTestBudget(categoryID)
			budgetData.Amount = budgetAmounts[i]

			resp = suite.helpers.MakeRequest("POST", "/budget", budgetData, token)
			suite.Equal(http.StatusCreated, resp.StatusCode, "Budget creation should succeed")
		}

		// Get all budgets to get their IDs
		resp = suite.helpers.MakeRequest("GET", "/budget", nil, token)
		suite.Equal(http.StatusOK, resp.StatusCode, "Should get budgets list")

		var budgets []map[string]interface{}
		err = resp.AsJSON(&budgets)
		suite.NoError(err, "Should parse budgets response")
		suite.Len(budgets, len(categories), "Should have budgets for all categories")

		// Extract budget IDs
		for _, budget := range budgets {
			budgetIDs = append(budgetIDs, budget["id"].(string))
		}

		// 7. Create Multiple Transactions
		transactions := []struct {
			name        string
			amount      float64
			transType   string
			categoryIdx int
		}{
			{"Supermercado Jumbo", 150.75, "bill", 0}, // Alimentación
			{"Gasolina", 80.00, "bill", 1},            // Transporte
			{"Cine", 25.00, "bill", 2},                // Entretenimiento
			{"Farmacia", 45.50, "bill", 3},            // Salud
			{"Salario", 3000.00, "income", 0},         // Ingreso
			{"Freelance", 500.00, "income", 0},        // Ingreso adicional
			{"Groceries", 120.30, "bill", 0},          // Más alimentación
			{"Bus pass", 60.00, "bill", 1},            // Más transporte
		}

		expectedBalance := accountData.InitialBalance

		for _, tx := range transactions {
			transactionData := &struct {
				Name        string  `json:"name"`
				Description string  `json:"description"`
				Amount      float64 `json:"amount"`
				Type        string  `json:"type_transation"`
				AccountID   string  `json:"account_id"`
				CategoryID  string  `json:"category_id"`
				BudgetID    string  `json:"budget_id"`
			}{
				Name:        tx.name,
				Description: fmt.Sprintf("E2E test transaction: %s", tx.name),
				Amount:      tx.amount,
				Type:        tx.transType,
				AccountID:   accountID,
				CategoryID:  categoryIDs[tx.categoryIdx],
				BudgetID:    budgetIDs[tx.categoryIdx],
			}

			resp = suite.helpers.MakeRequest("POST", "/transaction", transactionData, token)
			suite.Equal(http.StatusCreated, resp.StatusCode, "Transaction creation should succeed for %s", tx.name)

			// Update expected balance
			if tx.transType == "income" {
				expectedBalance += tx.amount
			} else {
				expectedBalance -= tx.amount
			}
		}

		// 8. Verify Account Balance After Transactions
		resp = suite.helpers.MakeRequest("GET", "/account", nil, token)
		suite.Equal(http.StatusOK, resp.StatusCode, "Should get updated account")

		err = resp.AsJSON(&accounts)
		suite.NoError(err, "Should parse updated accounts response")
		suite.Len(accounts, 1, "Should still have one account")

		updatedBalance := accounts[0]["current_balance"].(float64)
		suite.InDelta(expectedBalance, updatedBalance, 0.01, "Account balance should be updated correctly")

		// 9. Get All Transactions (paginated response)
		allTransactions, resp := suite.helpers.ListTransactions("/transaction?limit=100", token)
		suite.Equal(http.StatusOK, resp.StatusCode, "Should get all transactions")
		suite.Len(allTransactions.Data, len(transactions), "Should list every created transaction")

		// 10. Get Transactions by Account
		accountTransactions, resp := suite.helpers.ListTransactions(fmt.Sprintf("/transaction/%s?limit=100", accountID), token)
		suite.Equal(http.StatusOK, resp.StatusCode, "Should get transactions by account")
		suite.Len(accountTransactions.Data, len(transactions), "All transactions belong to the main account")
		for _, tx := range accountTransactions.Data {
			suite.Equal(accountID, tx.AccountID, "Account listing should only contain that account's transactions")
		}

		// 11. Create Second Account
		secondAccountData := suite.helpers.CreateTestAccount("savings")
		secondAccountData.Name = "Savings Account"
		secondAccountData.InitialBalance = 10000.0

		resp = suite.helpers.MakeRequest("POST", "/account", secondAccountData, token)
		suite.Equal(http.StatusCreated, resp.StatusCode, "Second account creation should succeed")

		// Verify we now have two accounts
		resp = suite.helpers.MakeRequest("GET", "/account", nil, token)
		suite.Equal(http.StatusOK, resp.StatusCode, "Should get both accounts")

		err = resp.AsJSON(&accounts)
		suite.NoError(err, "Should parse both accounts response")
		suite.Len(accounts, 2, "Should have two accounts")

		// 12. Transfer Between Accounts (using transactions)
		var savingsAccountID string
		for _, acc := range accounts {
			accInfo := acc["account_info"].(map[string]interface{})
			if accInfo["name"].(string) == secondAccountData.Name {
				savingsAccountID = accInfo["id"].(string)
				break
			}
		}
		suite.NotEmpty(savingsAccountID, "Should find savings account ID")

		// Transfer from main to savings (expense from main)
		transferOutData := &struct {
			Name        string  `json:"name"`
			Description string  `json:"description"`
			Amount      float64 `json:"amount"`
			Type        string  `json:"type_transation"`
			AccountID   string  `json:"account_id"`
			CategoryID  string  `json:"category_id"`
			BudgetID    string  `json:"budget_id"`
		}{
			Name:        "Transfer to Savings",
			Description: "Transfer from main account to savings",
			Amount:      1000.0,
			Type:        "bill",
			AccountID:   accountID,
			CategoryID:  categoryIDs[0],
			BudgetID:    budgetIDs[0],
		}

		resp = suite.helpers.MakeRequest("POST", "/transaction", transferOutData, token)
		suite.Equal(http.StatusCreated, resp.StatusCode, "Transfer out transaction should succeed")

		// Transfer to savings (income to savings)
		transferInData := &struct {
			Name        string  `json:"name"`
			Description string  `json:"description"`
			Amount      float64 `json:"amount"`
			Type        string  `json:"type_transation"`
			AccountID   string  `json:"account_id"`
			CategoryID  string  `json:"category_id"`
			BudgetID    string  `json:"budget_id"`
		}{
			Name:        "Transfer from Main",
			Description: "Transfer from main account to savings",
			Amount:      1000.0,
			Type:        "income",
			AccountID:   savingsAccountID,
			CategoryID:  categoryIDs[0],
			BudgetID:    budgetIDs[0],
		}

		resp = suite.helpers.MakeRequest("POST", "/transaction", transferInData, token)
		suite.Equal(http.StatusCreated, resp.StatusCode, "Transfer in transaction should succeed")

		// 13. Verify Final Balances
		resp = suite.helpers.MakeRequest("GET", "/account", nil, token)
		suite.Equal(http.StatusOK, resp.StatusCode, "Should get final account balances")

		err = resp.AsJSON(&accounts)
		suite.NoError(err, "Should parse final accounts response")

		var mainAccountBalance, savingsAccountBalance float64
		for _, acc := range accounts {
			accInfo := acc["account_info"].(map[string]interface{})
			switch accInfo["id"].(string) {
			case accountID:
				mainAccountBalance = acc["current_balance"].(float64)
			case savingsAccountID:
				savingsAccountBalance = acc["current_balance"].(float64)
			}
		}

		expectedMainBalance := expectedBalance - 1000.0
		expectedSavingsBalance := secondAccountData.InitialBalance + 1000.0

		suite.InDelta(expectedMainBalance, mainAccountBalance, 0.01, "Main account balance should be correct after transfer")
		suite.InDelta(expectedSavingsBalance, savingsAccountBalance, 0.01, "Savings account balance should be correct after transfer")

		// 14. Verify Database Consistency
		userCount = suite.helpers.CountRecords("users")
		accountCount := suite.helpers.CountRecords("accounts")
		categoryCount := suite.helpers.CountRecords("categories")
		budgetCount := suite.helpers.CountRecords("budgets")
		transactionCount := suite.helpers.CountRecords("transactions")

		suite.Equal(1, userCount, "Should have one user")
		suite.Equal(2, accountCount, "Should have two accounts")
		suite.Equal(len(categories), categoryCount, "Should have correct number of categories")
		suite.Equal(len(categories), budgetCount, "Should have correct number of budgets")

		// Transaction count verification - should have all transactions including transfers
		expectedTransactionCount := len(transactions) + 2 // +2 for transfers
		suite.T().Logf("Expected transactions: %d, Actual transactions: %d", expectedTransactionCount, transactionCount)

		suite.Equal(expectedTransactionCount, transactionCount, "Every transaction should be persisted exactly once")

		suite.T().Log("✅ Complete user flow test passed successfully!")
		suite.T().Logf("Final balances - Main: %.2f, Savings: %.2f", mainAccountBalance, savingsAccountBalance)
		suite.T().Logf("Database state - Users: %d, Accounts: %d, Categories: %d, Budgets: %d, Transactions: %d",
			userCount, accountCount, categoryCount, budgetCount, transactionCount)
	})
}

// TestMultipleUsersIsolation tests that multiple users' data remains isolated
func (suite *E2ETestSuite) TestMultipleUsersIsolation() {
	suite.Run("MultipleUsersIsolation", func() {
		// Create first user and their data
		user1Data := suite.helpers.CreateUserFlow("user1")

		// Create account for user1
		account1Data := suite.helpers.CreateTestAccount("user1")
		resp := suite.helpers.MakeRequest("POST", "/account", account1Data, user1Data.Token)
		suite.Equal(http.StatusCreated, resp.StatusCode, "User1 account creation should succeed")

		// Create second user and their data
		user2Data := suite.helpers.CreateUserFlow("user2")

		// Create account for user2
		account2Data := suite.helpers.CreateTestAccount("user2")
		resp = suite.helpers.MakeRequest("POST", "/account", account2Data, user2Data.Token)
		suite.Equal(http.StatusCreated, resp.StatusCode, "User2 account creation should succeed")

		// Each user has two accounts: the one from CreateUserFlow plus the one
		// created above. Both are named "Test Account <suffix>".
		accountIDs := func(token, wantName string) map[string]bool {
			accounts, resp := suite.helpers.ListAccounts(token)
			suite.Equal(http.StatusOK, resp.StatusCode, "Should get accounts")
			suite.Len(accounts, 2, "User should see exactly their own two accounts")
			ids := make(map[string]bool, len(accounts))
			for _, account := range accounts {
				suite.Equal(wantName, account.AccountInfo.Name, "User should only see their own accounts")
				ids[account.AccountInfo.ID] = true
			}
			return ids
		}

		// Verify user1 can only see their own accounts
		user1AccountIDs := accountIDs(user1Data.Token, account1Data.Name)
		suite.True(user1AccountIDs[user1Data.AccountID], "User1 should see their initial account")

		// Verify user2 can only see their own accounts
		user2AccountIDs := accountIDs(user2Data.Token, account2Data.Name)
		suite.True(user2AccountIDs[user2Data.AccountID], "User2 should see their initial account")

		for id := range user1AccountIDs {
			suite.False(user2AccountIDs[id], "Account %s must not be visible to both users", id)
		}

		// Verify categories are also isolated
		resp = suite.helpers.MakeRequest("GET", "/category", nil, user1Data.Token)
		suite.Equal(http.StatusOK, resp.StatusCode, "User1 should get their categories")

		var user1Categories []map[string]interface{}
		err := resp.AsJSON(&user1Categories)
		suite.NoError(err, "Should parse user1 categories")
		suite.Len(user1Categories, 1, "User1 should only see their own category")

		resp = suite.helpers.MakeRequest("GET", "/category", nil, user2Data.Token)
		suite.Equal(http.StatusOK, resp.StatusCode, "User2 should get their categories")

		var user2Categories []map[string]interface{}
		err = resp.AsJSON(&user2Categories)
		suite.NoError(err, "Should parse user2 categories")
		suite.Len(user2Categories, 1, "User2 should only see their own category")

		suite.T().Log("✅ Multiple users isolation test passed!")
	})
}

// TestAccountDeletion tests the account deletion flow
func (suite *E2ETestSuite) TestAccountDeletion() {
	suite.Run("AccountDeletion", func() {
		// Create user and initial setup
		userData := suite.helpers.CreateUserFlow("deletion")

		// Create multiple accounts
		account1Data := suite.helpers.CreateTestAccount("account1")
		resp := suite.helpers.MakeRequest("POST", "/account", account1Data, userData.Token)
		suite.Equal(http.StatusCreated, resp.StatusCode)

		account2Data := suite.helpers.CreateTestAccount("account2")
		resp = suite.helpers.MakeRequest("POST", "/account", account2Data, userData.Token)
		suite.Equal(http.StatusCreated, resp.StatusCode)

		// Get account IDs
		resp = suite.helpers.MakeRequest("GET", "/account", nil, userData.Token)
		suite.Equal(http.StatusOK, resp.StatusCode)

		var accounts []map[string]interface{}
		err := resp.AsJSON(&accounts)
		suite.NoError(err)
		// 3 = the CreateUserFlow account + the two created above
		suite.Len(accounts, 3, "Should have 3 accounts initially")

		accountInfo := accounts[0]["account_info"].(map[string]interface{})
		accountToDelete := accountInfo["id"].(string)

		// Delete one account
		resp = suite.helpers.MakeRequest("DELETE", fmt.Sprintf("/account/%s", accountToDelete), nil, userData.Token)
		suite.Equal(http.StatusOK, resp.StatusCode, "Account deletion should succeed")

		// Verify account was deleted
		resp = suite.helpers.MakeRequest("GET", "/account", nil, userData.Token)
		suite.Equal(http.StatusOK, resp.StatusCode)

		err = resp.AsJSON(&accounts)
		suite.NoError(err)
		suite.Len(accounts, 2, "Should have 2 accounts after deletion")

		// Verify the correct account was deleted
		for _, account := range accounts {
			remainingAccountInfo := account["account_info"].(map[string]interface{})
			suite.NotEqual(accountToDelete, remainingAccountInfo["id"], "Deleted account should not be in the list")
		}

		// Deleting it again is a 404
		resp = suite.helpers.MakeRequest("DELETE", fmt.Sprintf("/account/%s", accountToDelete), nil, userData.Token)
		suite.Equal(http.StatusNotFound, resp.StatusCode, "Deleting an already deleted account should be 404")

		suite.T().Log("✅ Account deletion test passed!")
	})
}
