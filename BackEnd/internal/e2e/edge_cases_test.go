//go:build e2e
// +build e2e

package e2e

import (
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"
)

// TestLargeDatasets tests handling of large datasets
func (suite *E2ETestSuite) TestLargeDatasets() {
	suite.Run("LargeDatasets", func() {
		userData := suite.helpers.CreateUserFlow("large")

		// Create many accounts
		numAccounts := 50
		accountIDs := make([]string, 0, numAccounts)

		for i := 0; i < numAccounts; i++ {
			accountData := &struct {
				Name           string  `json:"name"`
				Bank           string  `json:"bank"`
				InitialBalance float64 `json:"initial_balance"`
			}{
				Name:           fmt.Sprintf("Account %d", i),
				Bank:           fmt.Sprintf("Bank %d", i%5), // Cycle through 5 banks
				InitialBalance: float64(i * 1000),
			}

			// Account 0 is opened with a zero balance, which must be accepted.
			resp := suite.helpers.MakeRequest("POST", "/account", accountData, userData.Token)
			suite.Equal(http.StatusCreated, resp.StatusCode, "Account creation should succeed: %s", resp.AsString())
		}

		// Get all accounts
		accounts, resp := suite.helpers.ListAccounts(userData.Token)
		suite.Equal(http.StatusOK, resp.StatusCode, "Should retrieve all accounts")
		suite.Len(accounts, numAccounts+1, "Should have all created accounts plus initial one") // +1 for the account created in CreateUserFlow

		// Store account IDs for transaction tests
		for _, account := range accounts {
			accountIDs = append(accountIDs, account.AccountInfo.ID)
		}

		// Create many categories
		numCategories := 20
		categoryIDs := make([]string, 0, numCategories)

		for i := 0; i < numCategories; i++ {
			categoryData := &struct {
				Name  string `json:"name"`
				Icon  string `json:"icon"`
				Color string `json:"color"`
			}{
				Name:  fmt.Sprintf("Category %d", i),
				Icon:  "🏷️",
				Color: fmt.Sprintf("#%06X", (i*123456)%16777215),
			}

			resp := suite.helpers.MakeRequest("POST", "/category", categoryData, userData.Token)
			suite.Equal(http.StatusCreated, resp.StatusCode, "Category creation should succeed")
		}

		// Get all categories
		resp = suite.helpers.MakeRequest("GET", "/category", nil, userData.Token)
		suite.Equal(http.StatusOK, resp.StatusCode, "Should retrieve all categories")

		var categories []map[string]interface{}
		err := resp.AsJSON(&categories)
		suite.NoError(err, "Should parse categories response")
		suite.Len(categories, numCategories+1, "Should have all created categories plus initial one") // +1 for the category created in CreateUserFlow

		// Store category IDs for transaction tests
		for _, category := range categories {
			categoryIDs = append(categoryIDs, category["id"].(string))
		}

		// Create many transactions
		numTransactions := 100
		transactionTypes := []string{"bill", "income"}

		for i := 0; i < numTransactions; i++ {
			transactionData := &struct {
				Name        string  `json:"name"`
				Description string  `json:"description"`
				Amount      float64 `json:"amount"`
				Type        string  `json:"type_transation"`
				AccountID   string  `json:"account_id"`
				CategoryID  string  `json:"category_id"`
			}{
				Name:        fmt.Sprintf("Transaction %d", i),
				Description: fmt.Sprintf("Large dataset test transaction %d", i),
				Amount:      float64(10 + (i % 500)), // Vary amounts
				Type:        transactionTypes[i%2],
				AccountID:   accountIDs[i%len(accountIDs)],
				CategoryID:  categoryIDs[i%len(categoryIDs)],
			}

			resp := suite.helpers.MakeRequest("POST", "/transaction", transactionData, userData.Token)
			suite.Equal(http.StatusCreated, resp.StatusCode, "Transaction creation should succeed: %s", resp.AsString())
		}

		// Get all transactions (GET /transaction is paginated; 100 is the max page size)
		page, resp := suite.helpers.ListTransactions("/transaction?limit=100", userData.Token)
		suite.Equal(http.StatusOK, resp.StatusCode, "Should retrieve all transactions")
		suite.Len(page.Data, numTransactions, "Should have all created transactions")
		suite.Equal(int64(numTransactions), page.Pagination.TotalRecords, "Pagination total should match")

		// Verify database counts
		accountCount := suite.helpers.CountRecords("accounts")
		categoryCount := suite.helpers.CountRecords("categories")
		transactionCount := suite.helpers.CountRecords("transactions")

		suite.Equal(numAccounts+1, accountCount, "Should have correct number of accounts in database")
		suite.Equal(numCategories+1, categoryCount, "Should have correct number of categories in database")
		suite.Equal(numTransactions, transactionCount, "Should have correct number of transactions in database")

		suite.T().Log("✅ Large datasets test passed!")
		suite.T().Logf("Created %d accounts, %d categories, %d transactions", accountCount, categoryCount, transactionCount)
	})
}

// TestConcurrentRequests tests concurrent request handling
func (suite *E2ETestSuite) TestConcurrentRequests() {
	suite.Run("ConcurrentRequests", func() {
		userData := suite.helpers.CreateUserFlow("concurrent")

		// Test concurrent account creation
		suite.Run("ConcurrentAccountCreation", func() {
			numWorkers := 10
			var wg sync.WaitGroup
			results := make(chan bool, numWorkers)

			for i := 0; i < numWorkers; i++ {
				wg.Add(1)
				go func(index int) {
					defer wg.Done()

					accountData := &struct {
						Name           string  `json:"name"`
						Bank           string  `json:"bank"`
						InitialBalance float64 `json:"initial_balance"`
					}{
						Name:           fmt.Sprintf("Concurrent Account %d", index),
						Bank:           fmt.Sprintf("Bank %d", index),
						InitialBalance: 1000.0,
					}

					resp := suite.helpers.MakeRequest("POST", "/account", accountData, userData.Token)
					results <- resp.StatusCode == http.StatusCreated
				}(i)
			}

			wg.Wait()
			close(results)

			// Count successes
			successCount := 0
			for success := range results {
				if success {
					successCount++
				}
			}

			suite.Equal(numWorkers, successCount, "All concurrent account creations should succeed")

			// Verify all accounts were created
			accounts, resp := suite.helpers.ListAccounts(userData.Token)
			suite.Equal(http.StatusOK, resp.StatusCode)
			suite.Len(accounts, numWorkers+1, "Should have all concurrent accounts plus initial one")
		})

		// Test concurrent transaction creation
		suite.Run("ConcurrentTransactionCreation", func() {
			numWorkers := 20
			var wg sync.WaitGroup
			results := make(chan bool, numWorkers)

			for i := 0; i < numWorkers; i++ {
				wg.Add(1)
				go func(index int) {
					defer wg.Done()

					transactionData := &struct {
						Name        string  `json:"name"`
						Description string  `json:"description"`
						Amount      float64 `json:"amount"`
						Type        string  `json:"type_transation"`
						AccountID   string  `json:"account_id"`
						CategoryID  string  `json:"category_id"`
					}{
						Name:        fmt.Sprintf("Concurrent Transaction %d", index),
						Description: fmt.Sprintf("Concurrent test transaction %d", index),
						Amount:      100.0,
						Type:        "bill",
						AccountID:   userData.AccountID,
						CategoryID:  userData.CategoryID,
					}

					resp := suite.helpers.MakeRequest("POST", "/transaction", transactionData, userData.Token)
					results <- resp.StatusCode == http.StatusCreated
				}(i)
			}

			wg.Wait()
			close(results)

			// Count successes
			successCount := 0
			for success := range results {
				if success {
					successCount++
				}
			}

			suite.Equal(numWorkers, successCount, "All concurrent transaction creations should succeed")

			// Verify account balance was updated correctly
			accounts, resp := suite.helpers.ListAccounts(userData.Token)
			suite.Equal(http.StatusOK, resp.StatusCode)

			// Find the main account
			var mainBalance string
			found := false
			for _, account := range accounts {
				if account.AccountInfo.ID == userData.AccountID {
					mainBalance = account.CurrentBalance.String()
					found = true
					break
				}
			}
			suite.Require().True(found, "Should find main account")

			// Expected balance: initial 1000 - 20 transactions of 100 each (amounts are exact decimals)
			suite.Equal("-1000", mainBalance, "Account balance should be updated correctly")

			// Every concurrent transaction must have been persisted exactly once
			page, resp := suite.helpers.ListTransactions("/transaction/"+userData.AccountID+"?limit=100", userData.Token)
			suite.Equal(http.StatusOK, resp.StatusCode)
			suite.Len(page.Data, numWorkers, "All concurrent transactions should be stored")
		})
	})
}

// TestBoundaryValues tests boundary value scenarios
func (suite *E2ETestSuite) TestBoundaryValues() {
	suite.Run("BoundaryValues", func() {
		userData := suite.helpers.CreateUserFlow("boundary")

		// Test very long strings
		suite.Run("LongStrings", func() {
			longString := strings.Repeat("A", 1000)
			veryLongString := strings.Repeat("B", 10000)

			// Test long account name
			accountData := &struct {
				Name           string  `json:"name"`
				Bank           string  `json:"bank"`
				InitialBalance float64 `json:"initial_balance"`
			}{
				Name:           longString,
				Bank:           "Test Bank",
				InitialBalance: 1000.0,
			}

			// Names longer than the 255-character column are invalid input (400),
			// never a database error (500).
			resp := suite.helpers.MakeRequest("POST", "/account", accountData, userData.Token)
			suite.Equal(http.StatusBadRequest, resp.StatusCode, "Should reject a 1000-character name: %s", resp.AsString())
			suite.Equal("INVALID_JSON", resp.ErrorCode(), "Overlong name should fail request binding")

			// The longest accepted name is stored without truncation.
			maxName := strings.Repeat("Ñ", 255)
			accountData.Name = maxName
			resp = suite.helpers.MakeRequest("POST", "/account", accountData, userData.Token)
			suite.Equal(http.StatusCreated, resp.StatusCode, "Should accept a 255-character name: %s", resp.AsString())
			accounts, _ := suite.helpers.ListAccounts(userData.Token)
			stored := false
			for _, account := range accounts {
				stored = stored || account.AccountInfo.Name == maxName
			}
			suite.True(stored, "255-character account name should be stored without truncation")

			// Test very long description
			transactionData := &struct {
				Name        string  `json:"name"`
				Description string  `json:"description"`
				Amount      float64 `json:"amount"`
				Type        string  `json:"type_transation"`
				AccountID   string  `json:"account_id"`
				CategoryID  string  `json:"category_id"`
			}{
				Name:        "Test Transaction",
				Description: veryLongString,
				Amount:      100.0,
				Type:        "bill",
				AccountID:   userData.AccountID,
				CategoryID:  userData.CategoryID,
			}

			// Descriptions are TEXT: a 10000-character description is accepted.
			resp = suite.helpers.MakeRequest("POST", "/transaction", transactionData, userData.Token)
			suite.Equal(http.StatusCreated, resp.StatusCode,
				"Should accept very long descriptions: %s", resp.AsString())
		})

		// Test large amounts
		suite.Run("LargeAmounts", func() {
			largeAmount := 999999999.99 // max allowed initial balance

			accountData := &struct {
				Name           string  `json:"name"`
				Bank           string  `json:"bank"`
				InitialBalance float64 `json:"initial_balance"`
			}{
				Name:           "Large Balance Account",
				Bank:           "Test Bank",
				InitialBalance: largeAmount,
			}

			resp := suite.helpers.MakeRequest("POST", "/account", accountData, userData.Token)
			suite.Equal(http.StatusCreated, resp.StatusCode, "Should handle large amounts")

			// Verify the account was created with the exact balance (no float rounding)
			accounts, resp := suite.helpers.ListAccounts(userData.Token)
			suite.Equal(http.StatusOK, resp.StatusCode)

			found := false
			for _, account := range accounts {
				if account.AccountInfo.Name == "Large Balance Account" {
					found = true
					suite.Equal("999999999.99", account.AccountInfo.InitialBalance.String(),
						"Large initial balance should be stored exactly")
					suite.Equal("999999999.99", account.CurrentBalance.String(),
						"Large current balance should be reported exactly")
				}
			}
			suite.True(found, "Should find the large balance account")
		})

		// Test decimal precision
		suite.Run("DecimalPrecision", func() {
			preciseAmount := 123.456789

			transactionData := &struct {
				Name        string  `json:"name"`
				Description string  `json:"description"`
				Amount      float64 `json:"amount"`
				Type        string  `json:"type_transation"`
				AccountID   string  `json:"account_id"`
				CategoryID  string  `json:"category_id"`
			}{
				Name:        "Precise Amount Transaction",
				Description: "Testing decimal precision",
				Amount:      preciseAmount,
				Type:        "bill",
				AccountID:   userData.AccountID,
				CategoryID:  userData.CategoryID,
			}

			resp := suite.helpers.MakeRequest("POST", "/transaction", transactionData, userData.Token)
			suite.Equal(http.StatusCreated, resp.StatusCode, "Should handle precise amounts: %s", resp.AsString())

			// Verify the transaction was created with correct amount
			page, resp := suite.helpers.ListTransactions("/transaction", userData.Token)
			suite.Equal(http.StatusOK, resp.StatusCode)

			var stored string
			found := false
			for _, transaction := range page.Data {
				if transaction.Name == "Precise Amount Transaction" {
					stored = transaction.Amount.String()
					found = true
					break
				}
			}

			suite.True(found, "Should find precise amount transaction")
			// Money columns are DECIMAL(19,4): PostgreSQL rounds the typed value to
			// 4 places and the API returns the stored decimal exactly.
			suite.Equal("123.4568", stored, "Precise amount should be stored at storage scale (4)")
		})
	})
}

// TestRateLimiting tests rate limiting functionality
func (suite *E2ETestSuite) TestRateLimiting() {
	suite.Run("RateLimiting", func() {
		userData := suite.helpers.CreateUserFlow("ratelimit")

		// Test rapid requests to same endpoint
		suite.Run("RapidRequests", func() {
			numRequests := 100
			results := make(chan int, numRequests)

			// Make rapid requests
			for i := 0; i < numRequests; i++ {
				go func() {
					resp := suite.helpers.MakeRequest("GET", "/account", nil, userData.Token)
					results <- resp.StatusCode
				}()
			}

			// Collect results
			statusCodes := make(map[int]int)
			for i := 0; i < numRequests; i++ {
				code := <-results
				statusCodes[code]++
			}

			// Should have mostly 200s, but may have some 429s if rate limiting is strict
			suite.True(statusCodes[200] > 0, "Should have some successful requests")

			// If rate limiting is implemented, we might see 429s
			if rateLimitedCount, exists := statusCodes[429]; exists {
				suite.T().Logf("Rate limited %d out of %d requests", rateLimitedCount, numRequests)
			}
		})
	})
}

// TestLongRunningOperations tests scenarios with timeouts
func (suite *E2ETestSuite) TestLongRunningOperations() {
	suite.Run("LongRunningOperations", func() {
		userData := suite.helpers.CreateUserFlow("longrun")

		// Test request timeout behavior
		suite.Run("RequestHandling", func() {
			// Make a request and measure response time
			start := time.Now()
			resp := suite.helpers.MakeRequest("GET", "/account", nil, userData.Token)
			duration := time.Since(start)

			suite.Equal(http.StatusOK, resp.StatusCode, "Request should complete successfully")
			suite.True(duration < 30*time.Second, "Request should complete within reasonable time")

			suite.T().Logf("Request completed in %v", duration)
		})
	})
}

// TestSpecialCharacters tests handling of special characters
func (suite *E2ETestSuite) TestSpecialCharacters() {
	suite.Run("SpecialCharacters", func() {
		userData := suite.helpers.CreateUserFlow("special")

		specialStrings := []string{
			"Café & Restaurante",
			"María José's Account",
			"北京银行",
			"Account with émojis 🏦💰",
			"Special chars: !@#$%^&*()",
			"HTML <script>alert('xss')</script>",
			"SQL'; DROP TABLE users; --",
			"Unicode: αβγδε",
			"Newlines\nand\ttabs",
		}

		for i, specialString := range specialStrings {
			suite.Run(fmt.Sprintf("SpecialString_%d", i), func() {
				accountData := &struct {
					Name           string  `json:"name"`
					Bank           string  `json:"bank"`
					InitialBalance float64 `json:"initial_balance"`
				}{
					Name:           specialString,
					Bank:           "Test Bank",
					InitialBalance: 1000.0,
				}

				resp := suite.helpers.MakeRequest("POST", "/account", accountData, userData.Token)

				// Account names are free text: unicode, quotes, markup and SQL
				// metacharacters are accepted and stored verbatim (queries are
				// parameterized; escaping is the client's job when rendering).
				suite.Equal(http.StatusCreated, resp.StatusCode,
					"Should accept special characters: %q -> %s", specialString, resp.AsString())

				accounts, resp := suite.helpers.ListAccounts(userData.Token)
				suite.Equal(http.StatusOK, resp.StatusCode)

				found := false
				for _, account := range accounts {
					if account.AccountInfo.Name == specialString {
						found = true
						break
					}
				}
				suite.True(found, "Special string should round-trip unchanged: %q", specialString)
			})
		}
	})
}

// TestMemoryAndResourceUsage tests resource usage patterns
func (suite *E2ETestSuite) TestMemoryAndResourceUsage() {
	suite.Run("MemoryAndResourceUsage", func() {
		userData := suite.helpers.CreateUserFlow("memory")

		// Test creating and deleting many resources
		suite.Run("CreateAndDeleteCycle", func() {
			numCycles := 10
			numResourcesPerCycle := 10

			for cycle := 0; cycle < numCycles; cycle++ {
				accountIDs := make([]string, 0, numResourcesPerCycle)

				// Create resources
				for i := 0; i < numResourcesPerCycle; i++ {
					accountData := &struct {
						Name           string  `json:"name"`
						Bank           string  `json:"bank"`
						InitialBalance float64 `json:"initial_balance"`
					}{
						Name:           fmt.Sprintf("Cycle %d Account %d", cycle, i),
						Bank:           "Test Bank",
						InitialBalance: 1000.0,
					}

					resp := suite.helpers.MakeRequest("POST", "/account", accountData, userData.Token)
					suite.Equal(http.StatusCreated, resp.StatusCode)
				}

				// Get all accounts to collect IDs
				accounts, resp := suite.helpers.ListAccounts(userData.Token)
				suite.Equal(http.StatusOK, resp.StatusCode)

				prefix := fmt.Sprintf("Cycle %d Account ", cycle)
				for _, account := range accounts {
					if strings.HasPrefix(account.AccountInfo.Name, prefix) {
						accountIDs = append(accountIDs, account.AccountInfo.ID)
					}
				}
				suite.Len(accountIDs, numResourcesPerCycle, "Should find every account created in this cycle")

				// Delete resources
				for _, accountID := range accountIDs {
					resp := suite.helpers.MakeRequest("DELETE", fmt.Sprintf("/account/%s", accountID), nil, userData.Token)
					suite.Equal(http.StatusOK, resp.StatusCode)
				}

				// Verify resources were deleted
				accounts, resp = suite.helpers.ListAccounts(userData.Token)
				suite.Equal(http.StatusOK, resp.StatusCode)
				suite.Len(accounts, 1, "Only the CreateUserFlow account should remain")

				// Should not find any accounts from this cycle
				for _, account := range accounts {
					suite.False(strings.HasPrefix(account.AccountInfo.Name, prefix),
						"Deleted account should not be found")
				}
			}

			suite.T().Logf("✅ Completed %d create/delete cycles", numCycles)
		})
	})
}
