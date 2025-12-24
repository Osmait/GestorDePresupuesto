//go:build e2e
// +build e2e

package e2e

import (
	"fmt"
	"net/http"
	"sync"
)

// TestUserValidationErrors tests various user input validation scenarios
func (suite *E2ETestSuite) TestUserValidationErrors() {
	suite.Run("UserValidationErrors", func() {
		// Test empty name
		emptyNameData := map[string]interface{}{
			"name":      "",
			"last_name": "Doe",
			"email":     "test@example.com",
			"password":  "securepassword123",
		}

		resp := suite.helpers.MakeRequest("POST", "/user", emptyNameData, "")
		suite.Equal(http.StatusBadRequest, resp.StatusCode, "Should reject empty name")

		// Test empty last name
		emptyLastNameData := map[string]interface{}{
			"name":      "John",
			"last_name": "",
			"email":     "test@example.com",
			"password":  "securepassword123",
		}

		resp = suite.helpers.MakeRequest("POST", "/user", emptyLastNameData, "")
		suite.Equal(http.StatusBadRequest, resp.StatusCode, "Should reject empty last name")

		// Test invalid email
		invalidEmailData := map[string]interface{}{
			"name":      "John",
			"last_name": "Doe",
			"email":     "invalid-email",
			"password":  "securepassword123",
		}

		resp = suite.helpers.MakeRequest("POST", "/user", invalidEmailData, "")
		suite.Equal(http.StatusBadRequest, resp.StatusCode, "Should reject invalid email")

		// Test short password
		shortPasswordData := map[string]interface{}{
			"name":      "John",
			"last_name": "Doe",
			"email":     "test@example.com",
			"password":  "123",
		}

		resp = suite.helpers.MakeRequest("POST", "/user", shortPasswordData, "")
		suite.Equal(http.StatusBadRequest, resp.StatusCode, "Should reject short password")

		// Test missing required fields
		missingFieldData := map[string]interface{}{
			"name":  "John",
			"email": "test@example.com",
		}

		resp = suite.helpers.MakeRequest("POST", "/user", missingFieldData, "")
		suite.Equal(http.StatusBadRequest, resp.StatusCode, "Should reject missing required fields")

		suite.T().Log("✅ User validation errors test passed!")
	})
}

// TestAuthenticationErrors tests authentication failure scenarios
func (suite *E2ETestSuite) TestAuthenticationErrors() {
	suite.Run("AuthenticationErrors", func() {
		// Create a valid user first
		userData := suite.helpers.CreateTestUser("auth-test")
		resp := suite.helpers.MakeRequest("POST", "/user", userData, "")
		suite.Equal(http.StatusOK, resp.StatusCode)

		// Test wrong password
		wrongPasswordData := map[string]string{
			"email":    userData.Email,
			"password": "wrongpassword",
		}

		resp = suite.helpers.MakeRequest("POST", "/login", wrongPasswordData, "")
		suite.Equal(http.StatusUnauthorized, resp.StatusCode, "Should reject wrong password")

		// Test nonexistent user
		nonexistentUserData := map[string]string{
			"email":    "nonexistent@example.com",
			"password": "somepassword",
		}

		resp = suite.helpers.MakeRequest("POST", "/login", nonexistentUserData, "")
		suite.Equal(http.StatusUnauthorized, resp.StatusCode, "Should reject nonexistent user")

		// Test empty credentials
		emptyCredentials := map[string]string{
			"email":    "",
			"password": "",
		}

		resp = suite.helpers.MakeRequest("POST", "/login", emptyCredentials, "")
		suite.Equal(http.StatusBadRequest, resp.StatusCode, "Should reject empty credentials")

		// Test malformed login data
		malformedData := map[string]interface{}{
			"email":    123, // Invalid type
			"password": "somepassword",
		}

		resp = suite.helpers.MakeRequest("POST", "/login", malformedData, "")
		suite.Equal(http.StatusBadRequest, resp.StatusCode, "Should reject malformed login data")

		suite.T().Log("✅ Authentication errors test passed!")
	})
}

// TestAuthorizationErrors tests authorization failure scenarios
func (suite *E2ETestSuite) TestAuthorizationErrors() {
	suite.Run("AuthorizationErrors", func() {
		// Test accessing protected endpoints without token
		protectedEndpoints := []struct {
			method string
			path   string
		}{
			{"GET", "/profile"},
			{"GET", "/account"},
			{"POST", "/account"},
			{"GET", "/category"},
			{"POST", "/category"},
			{"GET", "/budget"},
			{"POST", "/budget"},
			{"GET", "/transaction"},
			{"POST", "/transaction"},
		}

		for _, endpoint := range protectedEndpoints {
			resp := suite.helpers.MakeRequest(endpoint.method, endpoint.path, nil, "")
			suite.Equal(http.StatusUnauthorized, resp.StatusCode,
				"Should reject %s %s without token", endpoint.method, endpoint.path)
		}

		// Test with invalid token
		invalidTokens := []string{
			"invalid-token",
			"Bearer invalid-token",
			"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid",
			"",
		}

		for _, token := range invalidTokens {
			resp := suite.helpers.MakeRequest("GET", "/profile", nil, token)
			suite.Equal(http.StatusUnauthorized, resp.StatusCode,
				"Should reject invalid token: %s", token)
		}

		suite.T().Log("✅ Authorization errors test passed!")
	})
}

// TestDuplicateEmailError tests duplicate email registration
func (suite *E2ETestSuite) TestDuplicateEmailError() {
	suite.Run("DuplicateEmailError", func() {
		// Create first user
		userData := suite.helpers.CreateTestUser("duplicate-test")
		resp := suite.helpers.MakeRequest("POST", "/user", userData, "")
		suite.Equal(http.StatusOK, resp.StatusCode, "First user creation should succeed")

		// Try to create second user with same email
		duplicateUserData := suite.helpers.CreateTestUser("duplicate-test2")
		duplicateUserData.Email = userData.Email // Same email

		resp = suite.helpers.MakeRequest("POST", "/user", duplicateUserData, "")
		suite.Equal(http.StatusConflict, resp.StatusCode, "Should reject duplicate email")

		suite.T().Log("✅ Duplicate email error test passed!")
	})
}

// TestResourceNotFoundErrors tests 404 scenarios
func (suite *E2ETestSuite) TestResourceNotFoundErrors() {
	suite.Run("ResourceNotFoundErrors", func() {
		// Create user and get token
		userData := suite.helpers.CreateUserFlow("notfound-test")

		// Test nonexistent resource IDs
		nonExistentID := "550e8400-e29b-41d4-a716-446655440000"

		notFoundEndpoints := []struct {
			method string
			path   string
		}{
			{"GET", fmt.Sprintf("/account/%s", nonExistentID)},
			{"PUT", fmt.Sprintf("/account/%s", nonExistentID)},
			{"DELETE", fmt.Sprintf("/account/%s", nonExistentID)},
			{"GET", fmt.Sprintf("/category/%s", nonExistentID)},
			{"PUT", fmt.Sprintf("/category/%s", nonExistentID)},
			{"DELETE", fmt.Sprintf("/category/%s", nonExistentID)},
			{"GET", fmt.Sprintf("/budget/%s", nonExistentID)},
			{"PUT", fmt.Sprintf("/budget/%s", nonExistentID)},
			{"DELETE", fmt.Sprintf("/budget/%s", nonExistentID)},
			{"GET", fmt.Sprintf("/transaction/%s", nonExistentID)},
			{"PUT", fmt.Sprintf("/transaction/%s", nonExistentID)},
			{"DELETE", fmt.Sprintf("/transaction/%s", nonExistentID)},
		}

		for _, endpoint := range notFoundEndpoints {
			resp := suite.helpers.MakeRequest(endpoint.method, endpoint.path, nil, userData.Token)
			suite.Equal(http.StatusNotFound, resp.StatusCode,
				"Should return 404 for %s %s", endpoint.method, endpoint.path)
		}

		suite.T().Log("✅ Resource not found errors test passed!")
	})
}

// TestAccountValidationErrors tests account creation validation
func (suite *E2ETestSuite) TestAccountValidationErrors() {
	suite.Run("AccountValidationErrors", func() {
		// Create user and get token
		userData := suite.helpers.CreateUserFlow("account-validation")

		// Test empty account name
		emptyNameAccount := map[string]interface{}{
			"name":            "",
			"bank":            "Test Bank",
			"account_number":  "123456789",
			"initial_balance": 1000.0,
		}

		resp := suite.helpers.MakeRequest("POST", "/account", emptyNameAccount, userData.Token)
		suite.Equal(http.StatusBadRequest, resp.StatusCode, "Should reject empty account name")

		// Test negative initial balance
		negativeBalanceAccount := map[string]interface{}{
			"name":            "Test Account",
			"bank":            "Test Bank",
			"account_number":  "123456789",
			"initial_balance": -100.0,
		}

		resp = suite.helpers.MakeRequest("POST", "/account", negativeBalanceAccount, userData.Token)
		suite.Equal(http.StatusBadRequest, resp.StatusCode, "Should reject negative initial balance")

		// Test missing required fields
		incompleteAccount := map[string]interface{}{
			"name": "Test Account",
			// Missing bank and account_number
		}

		resp = suite.helpers.MakeRequest("POST", "/account", incompleteAccount, userData.Token)
		suite.Equal(http.StatusBadRequest, resp.StatusCode, "Should reject incomplete account data")

		suite.T().Log("✅ Account validation errors test passed!")
	})
}

// TestTransactionValidationErrors tests transaction validation
func (suite *E2ETestSuite) TestTransactionValidationErrors() {
	suite.Run("TransactionValidationErrors", func() {
		// Create user with account and category
		userData := suite.helpers.CreateUserFlow("transaction-validation")

		// Get account and category IDs
		resp := suite.helpers.MakeRequest("GET", "/account", nil, userData.Token)
		suite.Equal(http.StatusOK, resp.StatusCode)

		var accounts []map[string]interface{}
		err := resp.AsJSON(&accounts)
		suite.NoError(err)
		suite.Len(accounts, 1)
		accountID := accounts[0]["id"].(string)

		resp = suite.helpers.MakeRequest("GET", "/category", nil, userData.Token)
		suite.Equal(http.StatusOK, resp.StatusCode)

		var categories []map[string]interface{}
		err = resp.AsJSON(&categories)
		suite.NoError(err)
		suite.Len(categories, 1)
		categoryID := categories[0]["id"].(string)

		// Test invalid transaction type
		invalidTypeTransaction := map[string]interface{}{
			"name":        "Test Transaction",
			"description": "Test",
			"amount":      100.0,
			"type":        "invalid-type",
			"account_id":  accountID,
			"category_id": categoryID,
		}

		resp = suite.helpers.MakeRequest("POST", "/transaction", invalidTypeTransaction, userData.Token)
		suite.Equal(http.StatusBadRequest, resp.StatusCode, "Should reject invalid transaction type")

		// Test negative amount
		negativeAmountTransaction := map[string]interface{}{
			"name":        "Test Transaction",
			"description": "Test",
			"amount":      -50.0,
			"type":        "bill",
			"account_id":  accountID,
			"category_id": categoryID,
		}

		resp = suite.helpers.MakeRequest("POST", "/transaction", negativeAmountTransaction, userData.Token)
		suite.Equal(http.StatusBadRequest, resp.StatusCode, "Should reject negative amount")

		// Test invalid account ID
		invalidAccountTransaction := map[string]interface{}{
			"name":        "Test Transaction",
			"description": "Test",
			"amount":      100.0,
			"type":        "bill",
			"account_id":  "invalid-account-id",
			"category_id": categoryID,
		}

		resp = suite.helpers.MakeRequest("POST", "/transaction", invalidAccountTransaction, userData.Token)
		suite.Equal(http.StatusBadRequest, resp.StatusCode, "Should reject invalid account ID")

		// Test invalid category ID
		invalidCategoryTransaction := map[string]interface{}{
			"name":        "Test Transaction",
			"description": "Test",
			"amount":      100.0,
			"type":        "bill",
			"account_id":  accountID,
			"category_id": "invalid-category-id",
		}

		resp = suite.helpers.MakeRequest("POST", "/transaction", invalidCategoryTransaction, userData.Token)
		suite.Equal(http.StatusBadRequest, resp.StatusCode, "Should reject invalid category ID")

		suite.T().Log("✅ Transaction validation errors test passed!")
	})
}

// TestConcurrentUserCreation tests race conditions in user creation
func (suite *E2ETestSuite) TestConcurrentUserCreation() {
	suite.Run("ConcurrentUserCreation", func() {
		const numUsers = 5
		var wg sync.WaitGroup
		results := make([]int, numUsers)

		// Create multiple users concurrently
		for i := 0; i < numUsers; i++ {
			wg.Add(1)
			go func(index int) {
				defer wg.Done()

				userData := suite.helpers.CreateTestUser(fmt.Sprintf("concurrent-%d", index))
				resp := suite.helpers.MakeRequest("POST", "/user", userData, "")
				results[index] = resp.StatusCode
			}(i)
		}

		wg.Wait()

		// All users should be created successfully
		successCount := 0
		for _, statusCode := range results {
			if statusCode == http.StatusOK {
				successCount++
			}
		}

		suite.Equal(numUsers, successCount, "All concurrent user creations should succeed")

		// Verify all users were created in database
		userCount := suite.helpers.CountRecords("users")
		suite.Equal(numUsers, userCount, "Should have all users in database")

		suite.T().Log("✅ Concurrent user creation test passed!")
	})
}

// TestInvalidJSONPayloads tests malformed JSON handling
func (suite *E2ETestSuite) TestInvalidJSONPayloads() {
	suite.Run("InvalidJSONPayloads", func() {
		// Create user for authenticated endpoints
		userData := suite.helpers.CreateUserFlow("json-test")

		// Test endpoints with invalid JSON
		invalidJSONTests := []struct {
			method   string
			path     string
			token    string
			expected int
		}{
			{"POST", "/user", "", http.StatusBadRequest},
			{"POST", "/login", "", http.StatusBadRequest},
			{"POST", "/account", userData.Token, http.StatusBadRequest},
			{"POST", "/category", userData.Token, http.StatusBadRequest},
			{"POST", "/budget", userData.Token, http.StatusBadRequest},
			{"POST", "/transaction", userData.Token, http.StatusBadRequest},
		}

		for _, test := range invalidJSONTests {
			// Send invalid JSON string
			resp := suite.helpers.MakeRequestWithRawBody(test.method, test.path,
				"{invalid-json}", test.token)
			suite.Equal(test.expected, resp.StatusCode,
				"Should reject invalid JSON for %s %s", test.method, test.path)
		}

		suite.T().Log("✅ Invalid JSON payloads test passed!")
	})
}
