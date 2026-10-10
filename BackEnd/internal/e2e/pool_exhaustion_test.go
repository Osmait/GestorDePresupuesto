//go:build e2e
// +build e2e

package e2e

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/osmait/gestorDePresupuesto/cmd/api/boostrap"
)

// Regression tests for the connection-pool deadlock seen under load: every
// authenticated request holds one pooled connection for its RLS transaction
// (RLSMiddleware), so any query that runs on the plain *sql.DB while that
// transaction is open needs a SECOND connection. With N concurrent requests
// and a pool of N, all of them wait forever for each other.
//
// The real application (boostrap.NewApp, the production wiring) is served
// with DB_MAX_OPEN_CONNS=1: a request that needs a second connection can never
// get it, so it hangs until the per-request client timeout and the test fails
// naming the route. A pool of one turns the race into a deterministic check.

const poolTestRequestTimeout = 8 * time.Second

// poolLimitedApp serves a fresh boostrap.NewApp whose *sql.DB is capped at
// maxOpen connections. MCP is enabled so its tools are covered too.
func (suite *E2ETestSuite) poolLimitedApp(maxOpen int) (*poolClient, func()) {
	cfg := *suite.config
	cfg.Database.MaxOpenConns = maxOpen
	cfg.Database.MaxIdleConns = maxOpen
	cfg.MCP.Enabled = true

	db, err := sql.Open("postgres", cfg.GetPostgresUrl())
	suite.Require().NoError(err)
	db.SetMaxOpenConns(maxOpen)
	db.SetMaxIdleConns(maxOpen)
	suite.Require().NoError(db.Ping())

	ctx, cancel := context.WithCancel(context.Background())
	app, err := boostrap.NewApp(ctx, &cfg, db)
	suite.Require().NoError(err)
	srv := httptest.NewServer(app.Server.Engine)

	client := &poolClient{base: srv.URL, http: &http.Client{Timeout: poolTestRequestTimeout}}
	return client, func() {
		// Close the pool first: requests still stuck waiting for a connection
		// (the bug under test) then fail with "database is closed" instead of
		// blocking srv.Close forever.
		cancel()
		_ = db.Close()
		srv.CloseClientConnections()
		srv.Close()
	}
}

// seedFeatureFlags restores the flags seeded by the migrations (cleanDatabase
// truncates feature_flags), so the feature-gated routes are reachable.
func (suite *E2ETestSuite) seedFeatureFlags() {
	suite.helpers.ExecuteSQL(`INSERT INTO feature_flags (key, name, default_enabled, scope) VALUES
		('module_investments', 'Investments Module', true, 'both'),
		('module_loans', 'Loans Module', true, 'both'),
		('module_credit_cards', 'Credit Cards Module', true, 'both'),
		('module_certificates', 'Certificates Module', true, 'both'),
		('ai_extraction', 'AI Extraction', true, 'both'),
		('ai_category_suggestions', 'AI Category Suggestions', true, 'both'),
		('ai_duplicate_detection', 'AI Duplicate Detection', true, 'both'),
		('ai_reconciliation', 'AI Reconciliation', true, 'both'),
		('ai_savings_plan', 'AI Savings Plan', true, 'both'),
		('ai_savings_goals_crud', 'AI Savings Goals', true, 'both'),
		('passkeys_enabled', 'Passkeys Login', false, 'both')
		ON CONFLICT (key) DO NOTHING`)
}

type poolClient struct {
	base string
	http *http.Client
}

type poolResponse struct {
	status  int
	body    []byte
	headers http.Header
}

func (r poolResponse) json() any {
	var v any
	_ = json.Unmarshal(r.body, &v)
	return v
}

func (c *poolClient) do(method, path string, body any, token string, headers map[string]string) (poolResponse, error) {
	var reader io.Reader
	if body != nil {
		raw, err := json.Marshal(body)
		if err != nil {
			return poolResponse{}, err
		}
		reader = bytes.NewReader(raw)
	}
	req, err := http.NewRequest(method, c.base+path, reader)
	if err != nil {
		return poolResponse{}, err
	}
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return poolResponse{}, err
	}
	defer func() { _ = resp.Body.Close() }()
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return poolResponse{}, err
	}
	return poolResponse{status: resp.StatusCode, body: raw, headers: resp.Header}, nil
}

// findID returns the shallowest "id" string in a decoded JSON value
// (breadth-first, object keys in sorted order, arrays in order).
func findID(v any) string {
	level := []any{v}
	for len(level) > 0 {
		var next []any
		for _, node := range level {
			switch n := node.(type) {
			case map[string]any:
				if id, ok := n["id"].(string); ok && id != "" {
					return id
				}
				keys := make([]string, 0, len(n))
				for k := range n {
					keys = append(keys, k)
				}
				sort.Strings(keys)
				for _, k := range keys {
					next = append(next, n[k])
				}
			case []any:
				next = append(next, n...)
			}
		}
		level = next
	}
	return ""
}

// routeChecker runs one request per route and fails the test, naming the
// route, when it hangs or returns an unexpected status.
type routeChecker struct {
	suite  *E2ETestSuite
	client *poolClient
}

// call performs the request. want lists the accepted statuses; empty means
// "any status below 500". A timeout is reported as a pool deadlock.
func (rc routeChecker) call(method, path string, body any, token string, want ...int) poolResponse {
	return rc.callWithHeaders(method, path, body, token, nil, want...)
}

func (rc routeChecker) callWithHeaders(method, path string, body any, token string, headers map[string]string, want ...int) poolResponse {
	name := method + " " + path
	started := time.Now()
	resp, err := rc.client.do(method, path, body, token, headers)
	if err != nil {
		rc.suite.Failf("route hung with DB_MAX_OPEN_CONNS=1",
			"%s did not answer within %s (%v): it needs a second pool connection while its request transaction holds the only one",
			name, time.Since(started).Round(time.Millisecond), err)
		return poolResponse{}
	}
	rc.suite.T().Logf("%s -> %d (%s)", name, resp.status, time.Since(started).Round(time.Millisecond))
	ok := false
	if len(want) == 0 {
		ok = resp.status < http.StatusInternalServerError
	}
	for _, w := range want {
		if resp.status == w {
			ok = true
		}
	}
	if !ok {
		rc.suite.Failf("unexpected status", "%s -> %d (want %v): %s", name, resp.status, want, string(resp.body))
	}
	return resp
}

// TestPoolOfOneServesEveryAuthenticatedRoute walks every authenticated route
// group with a single pooled connection.
func (suite *E2ETestSuite) TestPoolOfOneServesEveryAuthenticatedRoute() {
	suite.seedFeatureFlags()
	client, closeApp := suite.poolLimitedApp(1)
	defer closeApp()
	rc := routeChecker{suite: suite, client: client}

	// --- Users: a regular user and an admin -------------------------------
	register := func(suffix string) {
		rc.call("POST", "/user", map[string]string{
			"name": "Pool " + suffix, "last_name": "Test", "email": "pool-" + suffix + "@e2etest.com",
			"password": "SecureTestPassword123!",
		}, "", http.StatusOK)
	}
	login := func(suffix string) (string, string) {
		resp := rc.call("POST", "/auth/login", map[string]string{
			"email": "pool-" + suffix + "@e2etest.com", "password": "SecureTestPassword123!",
		}, "", http.StatusOK)
		var tokens struct {
			AccessToken  string `json:"access_token"`
			RefreshToken string `json:"refresh_token"`
		}
		suite.Require().NoError(json.Unmarshal(resp.body, &tokens), string(resp.body))
		return tokens.AccessToken, tokens.RefreshToken
	}
	register("user")
	register("admin")
	suite.helpers.ExecuteSQL(`UPDATE users SET role = 'ADMIN' WHERE email = 'pool-admin@e2etest.com'`)
	token, refresh := login("user")
	admin, _ := login("admin")

	var userID string
	suite.Require().NoError(suite.db.QueryRow(`SELECT id FROM users WHERE email = 'pool-user@e2etest.com'`).Scan(&userID))
	rc.call("GET", "/profile", nil, token, http.StatusOK)
	rc.call("GET", "/user/"+userID, nil, token, http.StatusOK)

	// --- Feature flags (admin + per-user), passkeys enabled for later -----
	rc.call("GET", "/me/features", nil, token, http.StatusOK)
	rc.call("GET", "/admin/features", nil, admin, http.StatusOK)
	rc.call("PATCH", "/admin/features/passkeys_enabled/global", map[string]any{"enabled": true, "reason": "pool test"}, admin, http.StatusOK)
	rc.call("GET", "/admin/users/"+userID+"/features", nil, admin, http.StatusOK)
	rc.call("PUT", "/admin/users/"+userID+"/features", map[string]any{
		"overrides": []map[string]any{{"feature_key": "module_loans", "enabled": true, "reason": "pool test"}},
	}, admin, http.StatusOK)
	rc.call("DELETE", "/admin/users/"+userID+"/features/module_loans", nil, admin, http.StatusOK)
	rc.call("GET", "/users", nil, admin, http.StatusOK)
	rc.call("DELETE", "/users/demos", nil, admin, http.StatusOK)

	// --- Accounts, categories, budgets, transactions -----------------------
	rc.call("POST", "/account", map[string]any{"name": "Pool account", "bank": "Pool bank", "initial_balance": "5000"}, token, http.StatusCreated)
	accountID := findID(rc.call("GET", "/account", nil, token, http.StatusOK).json())
	suite.Require().NotEmpty(accountID)
	rc.call("GET", "/account/"+accountID, nil, token, http.StatusOK)
	rc.call("PUT", "/account/"+accountID, map[string]any{"name": "Pool account 2", "bank": "Pool bank"}, token)

	rc.call("POST", "/category", map[string]any{"name": "Pool category", "icon": "x", "color": "#FFFFFF"}, token, http.StatusCreated)
	categoryID := findID(rc.call("GET", "/category", nil, token, http.StatusOK).json())
	suite.Require().NotEmpty(categoryID)
	rc.call("PUT", "/category/"+categoryID, map[string]any{"name": "Pool category 2", "icon": "x", "color": "#000000"}, token)

	rc.call("POST", "/budget", map[string]any{"category_id": categoryID, "amount": "100"}, token, http.StatusCreated)
	budgetID := findID(rc.call("GET", "/budget", nil, token, http.StatusOK).json())
	suite.Require().NotEmpty(budgetID)
	rc.call("PUT", "/budget/"+budgetID, map[string]any{"category_id": categoryID, "amount": "200"}, token)

	// A bill against the budget also triggers the budget-alert check.
	rc.call("POST", "/transaction", map[string]any{
		"name": "Pool bill", "amount": "150", "type_transation": "bill",
		"account_id": accountID, "category_id": categoryID, "budget_id": budgetID,
	}, token, http.StatusCreated)
	transactionID := findID(rc.call("GET", "/transaction", nil, token, http.StatusOK).json())
	suite.Require().NotEmpty(transactionID)
	rc.call("GET", "/transaction/"+accountID, nil, token, http.StatusOK)
	rc.call("PUT", "/transaction/"+transactionID, map[string]any{
		"name": "Pool bill 2", "amount": "120", "type_transation": "bill",
		"account_id": accountID, "category_id": categoryID,
	}, token)
	rc.call("GET", "/search?q=Pool", nil, token, http.StatusOK)

	// --- Analytics -----------------------------------------------------------
	rc.call("GET", "/analytics/category-expenses", nil, token, http.StatusOK)
	rc.call("GET", "/analytics/monthly-summary", nil, token, http.StatusOK)
	rc.call("GET", "/analytics/dashboard-summary", nil, token, http.StatusOK)

	// --- Investments ---------------------------------------------------------
	rc.call("POST", "/investments/funding", map[string]any{"source_account_id": accountID, "source_amount": "100"}, token, http.StatusOK, http.StatusCreated)
	rc.call("GET", "/investments/funding/balances", nil, token, http.StatusOK)
	rc.call("POST", "/investments", map[string]any{
		"type": "stock", "name": "Pool stock", "symbol": "POOL", "quantity": "1",
		"purchase_price": "10", "current_price": "10", "settlement_currency": "DOP",
	}, token, http.StatusOK, http.StatusCreated)
	investmentID := findID(rc.call("GET", "/investments", nil, token, http.StatusOK).json())
	suite.Require().NotEmpty(investmentID)
	rc.call("PUT", "/investments/"+investmentID, map[string]any{"name": "Pool stock 2"}, token)
	rc.call("DELETE", "/investments/"+investmentID, nil, token)

	// --- Credit cards (incl. payment and reset) -----------------------------
	resp := rc.call("POST", "/credit-cards", map[string]any{
		"name": "Pool card", "bank": "BHD", "cut_day": 10, "due_day": 25,
		"balances": []map[string]any{{"currency": "DOP", "credit_limit": "50000", "initial_debt": "500"}},
	}, token, http.StatusCreated)
	cardID := findID(resp.json())
	suite.Require().NotEmpty(cardID, string(resp.body))
	rc.call("GET", "/credit-cards", nil, token, http.StatusOK)
	rc.call("GET", "/credit-cards/summary", nil, token, http.StatusOK)
	rc.call("GET", "/credit-cards/"+cardID, nil, token, http.StatusOK)
	rc.call("PUT", "/credit-cards/"+cardID, map[string]any{"name": "Pool card", "bank": "BHD", "cut_day": 11, "due_day": 26}, token)
	rc.call("POST", "/credit-cards/"+cardID+"/payments", map[string]any{
		"from_account_id": accountID, "currency": "DOP", "amount": "100",
	}, token, http.StatusCreated)
	rc.call("GET", "/credit-cards/"+cardID+"/payments", nil, token, http.StatusOK)
	rc.call("POST", "/credit-cards/"+cardID+"/reset", map[string]any{"currency": "DOP"}, token)
	rc.call("GET", "/credit-cards/"+cardID+"/resets", nil, token, http.StatusOK)

	// --- Loans ----------------------------------------------------------------
	rc.call("POST", "/loan", map[string]any{
		"borrower_name": "Pool borrower", "principal_amount": "300", "interest_mode": "none",
		"term_months": 3, "source_account_id": accountID,
	}, token, http.StatusOK, http.StatusCreated)
	loanID := findID(rc.call("GET", "/loan", nil, token, http.StatusOK).json())
	suite.Require().NotEmpty(loanID)
	rc.call("GET", "/loan/summary", nil, token, http.StatusOK)
	rc.call("GET", "/loan/"+loanID, nil, token, http.StatusOK)
	rc.call("POST", "/loan/"+loanID+"/payments", map[string]any{"destination_account_id": accountID, "amount": "100"}, token, http.StatusOK, http.StatusCreated)
	rc.call("PATCH", "/loan/"+loanID+"/status", map[string]any{"status": "defaulted"}, token)
	rc.call("POST", "/loan/"+loanID+"/cancel", map[string]any{}, token)

	// --- Certificates (compound: exercises the effective-capital lookup) ----
	rc.call("POST", "/certificate", map[string]any{
		"bank": "Pool bank", "base_capital": "10000", "interest_type": "compound",
		"current_interest_rate": "5", "current_tax_rate": "10", "cut_day": 15,
		"reinvest_interest": true, "payout_account_id": accountID,
	}, token, http.StatusOK, http.StatusCreated)
	certificateID := findID(rc.call("GET", "/certificate", nil, token, http.StatusOK).json())
	suite.Require().NotEmpty(certificateID)
	rc.call("GET", "/certificate/summary", nil, token, http.StatusOK)
	rc.call("GET", "/certificate/"+certificateID, nil, token, http.StatusOK)
	rc.call("POST", "/certificate/"+certificateID+"/simulate", map[string]any{"months": 3}, token, http.StatusOK)
	rc.call("PUT", "/certificate/"+certificateID, map[string]any{"bank": "Pool bank 2"}, token, http.StatusOK)
	rc.call("DELETE", "/certificate/"+certificateID, nil, token)

	// --- Recurring transactions (incl. the on-demand processor) -------------
	rc.call("POST", "/recurring-transactions", map[string]any{
		"name": "Pool rent", "amount": "10", "type": "bill", "account_id": accountID,
		"category_id": categoryID, "day_of_month": time.Now().Day(),
	}, token, http.StatusOK, http.StatusCreated)
	recurringID := findID(rc.call("GET", "/recurring-transactions", nil, token, http.StatusOK).json())
	suite.Require().NotEmpty(recurringID)
	rc.call("POST", "/recurring-transactions/process", nil, token, http.StatusOK)
	rc.call("PUT", "/recurring-transactions/"+recurringID, map[string]any{
		"name": "Pool rent 2", "amount": "11", "type": "bill", "account_id": accountID,
		"category_id": categoryID, "day_of_month": 1,
	}, token)
	rc.call("DELETE", "/recurring-transactions/"+recurringID, nil, token)

	// --- Monthly plan -----------------------------------------------------------
	rc.call("POST", "/monthly-plan", map[string]any{"name": "Pool plan", "type": "bill", "amount": "50", "account_id": accountID}, token, http.StatusOK, http.StatusCreated)
	planID := findID(rc.call("GET", "/monthly-plan", nil, token, http.StatusOK).json())
	suite.Require().NotEmpty(planID)
	rc.call("GET", "/monthly-plan/summary", nil, token, http.StatusOK)
	rc.call("PUT", "/monthly-plan/"+planID, map[string]any{"name": "Pool plan 2", "type": "bill", "amount": "60"}, token)
	rc.call("PATCH", "/monthly-plan/"+planID+"/active", map[string]any{"is_active": false}, token)
	rc.call("DELETE", "/monthly-plan/"+planID, nil, token)

	// --- Notifications -----------------------------------------------------------
	rc.call("POST", "/notifications/test", nil, token, http.StatusOK)
	notificationID := findID(rc.call("GET", "/notifications/history", nil, token, http.StatusOK).json())
	if notificationID != "" {
		rc.call("PATCH", "/notifications/"+notificationID+"/read", nil, token)
	}
	rc.call("PATCH", "/notifications/read-all", nil, token, http.StatusOK)
	rc.call("DELETE", "/notifications", nil, token, http.StatusOK)

	// --- AI endpoints that do not call Gemini -------------------------------
	rc.call("POST", "/ai/goals/savings-plan", map[string]any{"target_amount": "1000", "account_id": accountID}, token, http.StatusOK)
	goal := rc.call("POST", "/ai/goals", map[string]any{"name": "Pool goal", "target_amount": "1000", "account_id": accountID}, token, http.StatusOK)
	goalID := findID(goal.json())
	suite.Require().NotEmpty(goalID, string(goal.body))
	rc.call("GET", "/ai/goals", nil, token, http.StatusOK)
	rc.call("PATCH", "/ai/goals/"+goalID, map[string]any{"name": "Pool goal 2", "account_id": accountID}, token, http.StatusOK)
	rc.call("GET", "/ai/goals/"+goalID+"/progress", nil, token, http.StatusOK)
	rc.call("DELETE", "/ai/goals/"+goalID, nil, token, http.StatusOK)
	rc.call("GET", "/ai/reconcile/missing-session", nil, token, http.StatusNotFound)
	rc.call("POST", "/ai/reconcile/missing-session/apply", map[string]any{
		"actions": []map[string]any{{"extracted_transaction_id": "x", "action": "ignore"}},
	}, token)

	// --- API keys + MCP tools (their own transaction, outside RLS) ----------
	key := rc.call("POST", "/api-keys", map[string]any{"name": "pool"}, token, http.StatusOK, http.StatusCreated)
	var created map[string]any
	suite.Require().NoError(json.Unmarshal(key.body, &created), string(key.body))
	rawKey := findString(created, "key", "api_key", "token", "raw_key")
	keyID := findID(created)
	rc.call("GET", "/api-keys", nil, token, http.StatusOK)
	if rawKey != "" {
		suite.exerciseMCP(rc, rawKey)
	} else {
		suite.Failf("api key", "could not find the raw API key in %s", string(key.body))
	}
	if keyID != "" {
		rc.call("DELETE", "/api-keys/"+keyID, nil, token)
	}

	// --- Passkeys (feature-gated; begin stores a ceremony session) ----------
	rc.call("GET", "/auth/passkey", nil, token, http.StatusOK)
	begin := rc.call("POST", "/auth/passkey/register/begin", map[string]any{}, token, http.StatusOK)
	var beginBody struct {
		SessionID string `json:"session_id"`
	}
	_ = json.Unmarshal(begin.body, &beginBody)
	// An invalid attestation: the ceremony consumes the session (inside the
	// request transaction) and then fails verification. The handler currently
	// reports verification failures as 500; what matters here is that it
	// answers instead of waiting for a second connection.
	rc.call("POST", "/auth/passkey/register/finish", map[string]any{
		"session_id": beginBody.SessionID, "name": "pool", "attestation_response": map[string]any{"id": "x"},
	}, token, http.StatusBadRequest, http.StatusInternalServerError)
	rc.call("DELETE", "/auth/passkey/missing", nil, token, http.StatusNotFound)
	rc.call("POST", "/auth/passkey/login/begin", map[string]any{}, "")
	rc.call("DELETE", "/admin/features/passkeys_enabled/global", nil, admin, http.StatusOK)

	// --- Clean-up deletes ---------------------------------------------------------
	rc.call("DELETE", "/transaction/"+transactionID, nil, token)
	rc.call("DELETE", "/budget/"+budgetID, nil, token)

	// --- Auth: refresh, logout-all (authenticated), logout -----------------
	refreshed := rc.call("POST", "/auth/refresh", map[string]string{"refresh_token": refresh}, "", http.StatusOK)
	var tokens struct {
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
	}
	suite.Require().NoError(json.Unmarshal(refreshed.body, &tokens))
	rc.call("POST", "/auth/logout-all", nil, tokens.AccessToken, http.StatusOK)
	rc.call("POST", "/auth/logout", map[string]string{"refresh_token": tokens.RefreshToken}, "")
}

// exerciseMCP initialises an MCP streamable-HTTP session with an API key and
// calls read and write tools.
func (suite *E2ETestSuite) exerciseMCP(rc routeChecker, apiKey string) {
	headers := map[string]string{"Accept": "application/json, text/event-stream"}
	init := rc.callWithHeaders("POST", "/mcp", map[string]any{
		"jsonrpc": "2.0", "id": 1, "method": "initialize",
		"params": map[string]any{
			"protocolVersion": "2025-03-26", "capabilities": map[string]any{},
			"clientInfo": map[string]any{"name": "pool-test", "version": "1"},
		},
	}, apiKey, headers, http.StatusOK)
	if session := init.headers.Get("Mcp-Session-Id"); session != "" {
		headers["Mcp-Session-Id"] = session
	}
	rc.callWithHeaders("POST", "/mcp", map[string]any{"jsonrpc": "2.0", "method": "notifications/initialized"}, apiKey, headers, http.StatusOK, http.StatusAccepted)
	for i, tool := range []string{"list_accounts", "list_categories", "get_balance", "analyze_spending"} {
		resp := rc.callWithHeaders("POST", "/mcp", map[string]any{
			"jsonrpc": "2.0", "id": 10 + i, "method": "tools/call",
			"params": map[string]any{"name": tool, "arguments": map[string]any{}},
		}, apiKey, headers, http.StatusOK)
		if strings.Contains(string(resp.body), "database error") {
			suite.Failf("mcp tool failed", "%s: %s", tool, string(resp.body))
		}
	}
}

func findString(m map[string]any, keys ...string) string {
	for _, k := range keys {
		if s, ok := m[k].(string); ok && s != "" {
			return s
		}
	}
	if data, ok := m["data"].(map[string]any); ok {
		return findString(data, keys...)
	}
	return ""
}

// TestConcurrentRequestsCompleteWithSmallPool fires 100 parallel requests
// across feature-gated and plain routes at a pool of 5. Before the fix five
// of them grabbed every connection for their RLS transaction and then waited
// forever for a second one in RequireFeature, hanging all the others.
func (suite *E2ETestSuite) TestConcurrentRequestsCompleteWithSmallPool() {
	suite.seedFeatureFlags()
	client, closeApp := suite.poolLimitedApp(5)
	defer closeApp()

	resp, err := client.do("POST", "/user", map[string]string{
		"name": "Pool", "last_name": "Concurrent", "email": "pool-concurrent@e2etest.com",
		"password": "SecureTestPassword123!",
	}, "", nil)
	suite.Require().NoError(err)
	suite.Require().Equal(http.StatusOK, resp.status, string(resp.body))
	resp, err = client.do("POST", "/auth/login", map[string]string{
		"email": "pool-concurrent@e2etest.com", "password": "SecureTestPassword123!",
	}, "", nil)
	suite.Require().NoError(err)
	var tokens struct {
		AccessToken string `json:"access_token"`
	}
	suite.Require().NoError(json.Unmarshal(resp.body, &tokens))
	token := tokens.AccessToken

	routes := []string{
		"/credit-cards", "/loan", "/certificate", "/investments", "/ai/goals",
		"/account", "/me/features", "/analytics/category-expenses", "/profile", "/monthly-plan",
	}
	const total = 100
	var (
		wg       sync.WaitGroup
		mu       sync.Mutex
		failures []string
	)
	start := make(chan struct{})
	for i := 0; i < total; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			<-start
			path := routes[i%len(routes)]
			r, err := client.do("GET", path, nil, token, nil)
			mu.Lock()
			defer mu.Unlock()
			if err != nil {
				failures = append(failures, fmt.Sprintf("GET %s: %v", path, err))
			} else if r.status != http.StatusOK {
				failures = append(failures, fmt.Sprintf("GET %s: %d %s", path, r.status, string(r.body)))
			}
		}(i)
	}
	began := time.Now()
	close(start)
	wg.Wait()
	suite.Empty(failures, "%d/%d concurrent requests failed or hung with a pool of 5 (took %s)",
		len(failures), total, time.Since(began).Round(time.Millisecond))
}
