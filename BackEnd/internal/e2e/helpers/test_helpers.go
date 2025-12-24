//go:build e2e
// +build e2e

package helpers

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	_ "github.com/lib/pq"
	"github.com/osmait/gestorDePresupuesto/internal/config"
)

// TestHelpers provides utility methods for E2E testing
type TestHelpers struct {
	BaseURL string
	Config  *config.Config
	db      *sql.DB
}

// NewTestHelpers creates a new TestHelpers instance
func NewTestHelpers(baseURL string, config *config.Config) *TestHelpers {
	helpers := &TestHelpers{
		BaseURL: baseURL,
		Config:  config,
	}

	// Initialize database connection
	helpers.initDatabase()

	return helpers
}

// initDatabase initializes the database connection
func (h *TestHelpers) initDatabase() {
	dbURL := fmt.Sprintf("postgres://%s:%s@%s:%d/%s?sslmode=%s",
		h.Config.Database.User,
		h.Config.Database.Password,
		h.Config.Database.Host,
		h.Config.Database.Port,
		h.Config.Database.Name,
		h.Config.Database.SSLMode,
	)

	var err error
	h.db, err = sql.Open("postgres", dbURL)
	if err != nil {
		panic(fmt.Sprintf("Failed to connect to test database: %v", err))
	}

	// Test the connection
	if err = h.db.Ping(); err != nil {
		panic(fmt.Sprintf("Failed to ping test database: %v", err))
	}
}

// HTTPResponse represents a generic HTTP response
type HTTPResponse struct {
	StatusCode int
	Body       []byte
	Headers    http.Header
}

// AsJSON unmarshals the response body into the provided interface
func (r *HTTPResponse) AsJSON(v interface{}) error {
	return json.Unmarshal(r.Body, v)
}

// AsString returns the response body as a string
func (r *HTTPResponse) AsString() string {
	return string(r.Body)
}

// MakeRequest makes an HTTP request with the specified parameters
func (h *TestHelpers) MakeRequest(method, path string, body interface{}, token string) *HTTPResponse {
	var reqBody io.Reader

	if body != nil {
		jsonData, err := json.Marshal(body)
		if err != nil {
			panic(fmt.Sprintf("Failed to marshal request body: %v", err))
		}
		reqBody = bytes.NewBuffer(jsonData)
	}

	url := h.BaseURL + path
	req, err := http.NewRequest(method, url, reqBody)
	if err != nil {
		panic(fmt.Sprintf("Failed to create request: %v", err))
	}

	// Set headers
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	// Make the request
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		panic(fmt.Sprintf("Failed to make request: %v", err))
	}
	defer resp.Body.Close()

	// Read response body
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		panic(fmt.Sprintf("Failed to read response body: %v", err))
	}

	return &HTTPResponse{
		StatusCode: resp.StatusCode,
		Body:       respBody,
		Headers:    resp.Header,
	}
}

// MakeRequestWithRawBody makes an HTTP request with a raw string body
func (h *TestHelpers) MakeRequestWithRawBody(method, path string, body string, token string) *HTTPResponse {
	var reqBody io.Reader

	if body != "" {
		reqBody = strings.NewReader(body)
	}

	url := h.BaseURL + path
	req, err := http.NewRequest(method, url, reqBody)
	if err != nil {
		panic(fmt.Sprintf("Failed to create request: %v", err))
	}

	// Set headers
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	// Make the request
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		panic(fmt.Sprintf("Failed to make request: %v", err))
	}
	defer resp.Body.Close()

	// Read response body
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		panic(fmt.Sprintf("Failed to read response body: %v", err))
	}

	return &HTTPResponse{
		StatusCode: resp.StatusCode,
		Body:       respBody,
		Headers:    resp.Header,
	}
}

// ExecuteSQL executes a SQL query on the test database
func (h *TestHelpers) ExecuteSQL(query string, args ...interface{}) {
	_, err := h.db.Exec(query, args...)
	if err != nil {
		panic(fmt.Sprintf("Failed to execute SQL: %v", err))
	}
}

// QuerySQL executes a SQL query and returns the result
func (h *TestHelpers) QuerySQL(query string, args ...interface{}) *sql.Rows {
	rows, err := h.db.Query(query, args...)
	if err != nil {
		panic(fmt.Sprintf("Failed to query SQL: %v", err))
	}
	return rows
}

// CountRecords returns the number of records in a table
func (h *TestHelpers) CountRecords(table string) int {
	// Fix table name mapping for inconsistent naming
	tableMap := map[string]string{
		"accounts":     "account",      // Map plural to singular
		"categories":   "categorys",    // Map standard plural to schema name
		"users":        "users",        // Keep as is
		"budgets":      "budgets",      // Keep as is
		"transactions": "transactions", // Keep as is
	}

	actualTable := table
	if mapped, exists := tableMap[table]; exists {
		actualTable = mapped
	}

	query := fmt.Sprintf("SELECT COUNT(*) FROM %s", actualTable)
	var count int
	err := h.db.QueryRow(query).Scan(&count)
	if err != nil {
		panic(fmt.Sprintf("Failed to count records in %s: %v", table, err))
	}
	return count
}

// UserTestData represents test data for user creation
type UserTestData struct {
	Name     string `json:"name"`
	LastName string `json:"last_name"`
	Email    string `json:"email"`
	Password string `json:"password"`
}

// AccountTestData represents test data for account creation
type AccountTestData struct {
	Name           string  `json:"name"`
	Bank           string  `json:"bank"`
	InitialBalance float64 `json:"initial_balance"`
}

// CategoryTestData represents test data for category creation
type CategoryTestData struct {
	Name  string `json:"name"`
	Icon  string `json:"icon"`
	Color string `json:"color"`
}

// TransactionTestData represents test data for transaction creation
type TransactionTestData struct {
	Name        string  `json:"name"`
	Description string  `json:"description"`
	Amount      float64 `json:"amount"`
	Type        string  `json:"type_transation"`
	AccountID   string  `json:"account_id"`
	CategoryID  string  `json:"category_id"`
	BudgetID    string  `json:"budget_id"`
}

// BudgetTestData represents test data for budget creation
type BudgetTestData struct {
	CategoryID string  `json:"category_id"`
	Amount     float64 `json:"amount"`
}

// CreateTestUser creates a test user and returns the user data
func (h *TestHelpers) CreateTestUser(suffix string) *UserTestData {
	return &UserTestData{
		Name:     fmt.Sprintf("Test User %s", suffix),
		LastName: fmt.Sprintf("Last Name %s", suffix),
		Email:    fmt.Sprintf("testuser%s@e2etest.com", suffix),
		Password: "SecureTestPassword123!",
	}
}

// CreateTestAccount creates test account data
func (h *TestHelpers) CreateTestAccount(suffix string) *AccountTestData {
	return &AccountTestData{
		Name:           fmt.Sprintf("Test Account %s", suffix),
		Bank:           fmt.Sprintf("Test Bank %s", suffix),
		InitialBalance: 1000.0,
	}
}

// CreateTestCategory creates test category data
func (h *TestHelpers) CreateTestCategory(suffix string) *CategoryTestData {
	return &CategoryTestData{
		Name:  fmt.Sprintf("Test Category %s", suffix),
		Icon:  "🧪",
		Color: "#FF5733",
	}
}

// CreateTestTransaction creates test transaction data
func (h *TestHelpers) CreateTestTransaction(accountID, categoryID, budgetID, suffix string) *TransactionTestData {
	return &TransactionTestData{
		Name:        fmt.Sprintf("Test Transaction %s", suffix),
		Description: fmt.Sprintf("Test transaction description %s", suffix),
		Amount:      100.0,
		Type:        "bill",
		AccountID:   accountID,
		CategoryID:  categoryID,
		BudgetID:    budgetID,
	}
}

// CreateTestBudget creates test budget data
func (h *TestHelpers) CreateTestBudget(categoryID string) *BudgetTestData {
	return &BudgetTestData{
		CategoryID: categoryID,
		Amount:     500.0,
	}
}

// RegisterAndLoginUser creates a user and returns the JWT token
func (h *TestHelpers) RegisterAndLoginUser(suffix string) (string, *UserTestData) {
	// Create user data
	userData := h.CreateTestUser(suffix)

	// Register user
	resp := h.MakeRequest("POST", "/user", userData, "")
	if resp.StatusCode != http.StatusOK {
		panic(fmt.Sprintf("Failed to register user: %d - %s", resp.StatusCode, resp.AsString()))
	}

	// Login user
	loginData := map[string]string{
		"email":    userData.Email,
		"password": userData.Password,
	}

	resp = h.MakeRequest("POST", "/login", loginData, "")
	if resp.StatusCode != http.StatusOK {
		panic(fmt.Sprintf("Failed to login user: %d - %s", resp.StatusCode, resp.AsString()))
	}

	// Extract token (remove quotes if present)
	token := strings.Trim(resp.AsString(), "\"")

	return token, userData
}

// CreateUserFlow creates a complete user with account, category, and initial data
func (h *TestHelpers) CreateUserFlow(suffix string) *CompleteUserData {
	// Register and login user
	token, userData := h.RegisterAndLoginUser(suffix)

	// Create account
	accountData := h.CreateTestAccount(suffix)
	resp := h.MakeRequest("POST", "/account", accountData, token)
	if resp.StatusCode != http.StatusCreated {
		panic(fmt.Sprintf("Failed to create account: %d - %s", resp.StatusCode, resp.AsString()))
	}

	// Get account ID
	resp = h.MakeRequest("GET", "/account", nil, token)
	if resp.StatusCode != http.StatusOK {
		panic(fmt.Sprintf("Failed to get accounts: %d - %s", resp.StatusCode, resp.AsString()))
	}

	var accounts []map[string]interface{}
	if err := resp.AsJSON(&accounts); err != nil {
		panic(fmt.Sprintf("Failed to parse accounts response: %v", err))
	}

	if len(accounts) == 0 {
		panic("No accounts found after creation")
	}

	// Access account ID from nested structure
	accountInfo := accounts[0]["account_info"].(map[string]interface{})
	accountID := accountInfo["id"].(string)

	// Create category
	categoryData := h.CreateTestCategory(suffix)
	resp = h.MakeRequest("POST", "/category", categoryData, token)
	if resp.StatusCode != http.StatusCreated {
		panic(fmt.Sprintf("Failed to create category: %d - %s", resp.StatusCode, resp.AsString()))
	}

	// Get category ID
	resp = h.MakeRequest("GET", "/category", nil, token)
	if resp.StatusCode != http.StatusOK {
		panic(fmt.Sprintf("Failed to get categories: %d - %s", resp.StatusCode, resp.AsString()))
	}

	var categories []map[string]interface{}
	if err := resp.AsJSON(&categories); err != nil {
		panic(fmt.Sprintf("Failed to parse categories response: %v", err))
	}

	if len(categories) == 0 {
		panic("No categories found after creation")
	}

	categoryID := categories[0]["id"].(string)

	return &CompleteUserData{
		Token:      token,
		User:       userData,
		AccountID:  accountID,
		CategoryID: categoryID,
	}
}

// CompleteUserData represents a complete user setup for testing
type CompleteUserData struct {
	Token      string
	User       *UserTestData
	AccountID  string
	CategoryID string
}

// WaitForCondition waits for a condition to be true with timeout
func (h *TestHelpers) WaitForCondition(condition func() bool, timeout time.Duration, message string) {
	deadline := time.Now().Add(timeout)

	for time.Now().Before(deadline) {
		if condition() {
			return
		}
		time.Sleep(100 * time.Millisecond)
	}

	panic(fmt.Sprintf("Timeout waiting for condition: %s", message))
}

// Close closes the database connection
func (h *TestHelpers) Close() {
	if h.db != nil {
		h.db.Close()
	}
}
