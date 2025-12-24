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

			resp := suite.helpers.MakeRequest("POST", "/account", accountData, userData.Token)
			suite.Equal(http.StatusOK, resp.StatusCode, "Account creation should succeed")
		}

		// Get all accounts
		resp := suite.helpers.MakeRequest("GET", "/account", nil, userData.Token)
		suite.Equal(http.StatusOK, resp.StatusCode, "Should retrieve all accounts")

		var accounts []map[string]interface{}
		err := resp.AsJSON(&accounts)
		suite.NoError(err, "Should parse accounts response")
		suite.Len(accounts, numAccounts+1, "Should have all created accounts plus initial one") // +1 for the account created in CreateUserFlow

		// Store account IDs for transaction tests
		for _, account := range accounts {
			accountIDs = append(accountIDs, account["id"].(string))
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
			suite.Equal(http.StatusOK, resp.StatusCode, "Category creation should succeed")
		}

		// Get all categories
		resp = suite.helpers.MakeRequest("GET", "/category", nil, userData.Token)
		suite.Equal(http.StatusOK, resp.StatusCode, "Should retrieve all categories")

		var categories []map[string]interface{}
		err = resp.AsJSON(&categories)
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
				Type        string  `json:"type"`
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
			suite.Equal(http.StatusOK, resp.StatusCode, "Transaction creation should succeed")
		}

		// Get all transactions
		resp = suite.helpers.MakeRequest("GET", "/transaction", nil, userData.Token)
		suite.Equal(http.StatusOK, resp.StatusCode, "Should retrieve all transactions")

		var transactions []map[string]interface{}
		err = resp.AsJSON(&transactions)
		suite.NoError(err, "Should parse transactions response")
		suite.Len(transactions, numTransactions, "Should have all created transactions")

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
					results <- resp.StatusCode == http.StatusOK
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
			resp := suite.helpers.MakeRequest("GET", "/account", nil, userData.Token)
			suite.Equal(http.StatusOK, resp.StatusCode)

			var accounts []map[string]interface{}
			err := resp.AsJSON(&accounts)
			suite.NoError(err)
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
						Type        string  `json:"type"`
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
					results <- resp.StatusCode == http.StatusOK
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
			resp := suite.helpers.MakeRequest("GET", "/account", nil, userData.Token)
			suite.Equal(http.StatusOK, resp.StatusCode)

			var accounts []map[string]interface{}
			err := resp.AsJSON(&accounts)
			suite.NoError(err)

			// Find the main account
			var mainAccount map[string]interface{}
			for _, account := range accounts {
				if account["id"].(string) == userData.AccountID {
					mainAccount = account
					break
				}
			}

			suite.NotNil(mainAccount, "Should find main account")

			// Calculate expected balance (initial 1000 - 20 transactions of 100 each)
			expectedBalance := 1000.0 - float64(numWorkers)*100.0
			actualBalance := mainAccount["balance"].(float64)
			suite.InDelta(expectedBalance, actualBalance, 0.01, "Account balance should be updated correctly")
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

			resp := suite.helpers.MakeRequest("POST", "/account", accountData, userData.Token)
			// Should either succeed or return validation error (depends on implementation)
			suite.True(resp.StatusCode == http.StatusOK || resp.StatusCode == http.StatusBadRequest,
				"Should handle long strings gracefully")

			// Test very long description
			transactionData := &struct {
				Name        string  `json:"name"`
				Description string  `json:"description"`
				Amount      float64 `json:"amount"`
				Type        string  `json:"type"`
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

			resp = suite.helpers.MakeRequest("POST", "/transaction", transactionData, userData.Token)
			// Should either succeed or return validation error
			suite.True(resp.StatusCode == http.StatusOK || resp.StatusCode == http.StatusBadRequest,
				"Should handle very long descriptions gracefully")
		})

		// Test large amounts
		suite.Run("LargeAmounts", func() {
			largeAmount := 999999999.99

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
			suite.Equal(http.StatusOK, resp.StatusCode, "Should handle large amounts")

			// Verify the account was created with correct balance
			resp = suite.helpers.MakeRequest("GET", "/account", nil, userData.Token)
			suite.Equal(http.StatusOK, resp.StatusCode)

			var accounts []map[string]interface{}
			err := resp.AsJSON(&accounts)
			suite.NoError(err)

			// Find the account with large balance
			var largeAccount map[string]interface{}
			for _, account := range accounts {
				if account["name"].(string) == "Large Balance Account" {
					largeAccount = account
					break
				}
			}

			if largeAccount != nil {
				suite.InDelta(largeAmount, largeAccount["balance"].(float64), 0.01,
					"Large amount should be stored correctly")
			}
		})

		// Test decimal precision
		suite.Run("DecimalPrecision", func() {
			preciseAmount := 123.456789

			transactionData := &struct {
				Name        string  `json:"name"`
				Description string  `json:"description"`
				Amount      float64 `json:"amount"`
				Type        string  `json:"type"`
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
			suite.Equal(http.StatusOK, resp.StatusCode, "Should handle precise amounts")

			// Verify the transaction was created with correct amount
			resp = suite.helpers.MakeRequest("GET", "/transaction", nil, userData.Token)
			suite.Equal(http.StatusOK, resp.StatusCode)

			var transactions []map[string]interface{}
			err := resp.AsJSON(&transactions)
			suite.NoError(err)

			// Find the precise amount transaction
			var preciseTransaction map[string]interface{}
			for _, transaction := range transactions {
				if transaction["name"].(string) == "Precise Amount Transaction" {
					preciseTransaction = transaction
					break
				}
			}

			suite.NotNil(preciseTransaction, "Should find precise amount transaction")
			suite.InDelta(preciseAmount, preciseTransaction["amount"].(float64), 0.01,
				"Precise amount should be stored with reasonable precision")
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

				// Should either succeed or return validation error (not crash)
				suite.True(resp.StatusCode == http.StatusOK || resp.StatusCode == http.StatusBadRequest,
					"Should handle special characters gracefully: %s", specialString)

				// If successful, verify the data was stored correctly
				if resp.StatusCode == http.StatusOK {
					resp = suite.helpers.MakeRequest("GET", "/account", nil, userData.Token)
					suite.Equal(http.StatusOK, resp.StatusCode)

					var accounts []map[string]interface{}
					err := resp.AsJSON(&accounts)
					suite.NoError(err)

					// Find the account with special characters
					found := false
					for _, account := range accounts {
						if account["name"].(string) == specialString {
							found = true
							break
						}
					}

					if found {
						suite.T().Logf("✅ Special string stored correctly: %s", specialString)
					}
				}
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
					suite.Equal(http.StatusOK, resp.StatusCode)
				}

				// Get all accounts to collect IDs
				resp := suite.helpers.MakeRequest("GET", "/account", nil, userData.Token)
				suite.Equal(http.StatusOK, resp.StatusCode)

				var accounts []map[string]interface{}
				err := resp.AsJSON(&accounts)
				suite.NoError(err)

				for _, account := range accounts {
					name := account["name"].(string)
					if strings.Contains(name, fmt.Sprintf("Cycle %d", cycle)) {
						accountIDs = append(accountIDs, account["id"].(string))
					}
				}

				// Delete resources
				for _, accountID := range accountIDs {
					resp := suite.helpers.MakeRequest("DELETE", fmt.Sprintf("/account/%s", accountID), nil, userData.Token)
					suite.Equal(http.StatusOK, resp.StatusCode)
				}

				// Verify resources were deleted
				resp = suite.helpers.MakeRequest("GET", "/account", nil, userData.Token)
				suite.Equal(http.StatusOK, resp.StatusCode)

				err = resp.AsJSON(&accounts)
				suite.NoError(err)

				// Should not find any accounts from this cycle
				for _, account := range accounts {
					name := account["name"].(string)
					suite.False(strings.Contains(name, fmt.Sprintf("Cycle %d", cycle)),
						"Deleted account should not be found")
				}
			}

			suite.T().Logf("✅ Completed %d create/delete cycles", numCycles)
		})
	})
}
