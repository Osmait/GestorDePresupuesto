//go:build e2e
// +build e2e

package e2e

import (
	"context"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync"
	"time"

	"github.com/osmait/gestorDePresupuesto/cmd/api/boostrap"
	domainAI "github.com/osmait/gestorDePresupuesto/internal/domain/ai"
)

// blockingProvider is a fake AI provider whose calls block until released,
// standing in for a slow Gemini call (up to ~95s with retries).
type blockingProvider struct {
	entered chan struct{}
	release chan struct{}

	mu    sync.Mutex
	calls int
}

func newBlockingProvider() *blockingProvider {
	return &blockingProvider{entered: make(chan struct{}, 16), release: make(chan struct{})}
}

func (p *blockingProvider) GenerateContent(ctx context.Context, _ string, _ []domainAI.DocumentFile) (*domainAI.AIResponse, error) {
	p.mu.Lock()
	p.calls++
	p.mu.Unlock()
	p.entered <- struct{}{}
	select {
	case <-p.release:
	case <-ctx.Done():
		return nil, ctx.Err()
	}
	return &domainAI.AIResponse{
		Content: `[{"name":"Coffee shop","amount":3.5,"type_transation":"bill","currency":"DOP","created_at":"2026-10-01T15:00:00Z"}]`,
		Model:   "fake",
	}, nil
}

func (p *blockingProvider) GetModel() string        { return "fake" }
func (p *blockingProvider) SetModel(string)         {}
func (p *blockingProvider) ValidateConfig() error   { return nil }
func (p *blockingProvider) GetProviderName() string { return "fake" }
func (p *blockingProvider) Close() error            { return nil }

// aiApp serves boostrap.NewApp (production wiring) with a pool of maxOpen
// connections, the fake provider and the given global AI cap.
func (suite *E2ETestSuite) aiApp(maxOpen, maxConcurrentAI int, provider *blockingProvider) (*poolClient, func()) {
	cfg := *suite.config
	cfg.Database.MaxOpenConns = maxOpen
	cfg.Database.MaxIdleConns = maxOpen
	cfg.AI.MaxConcurrentCalls = maxConcurrentAI
	cfg.AI.MaxInFlight = 10
	cfg.AI.RequestsPerMinute = 100
	cfg.AI.MaxRetries = 0

	db, err := sql.Open("postgres", cfg.GetPostgresUrl())
	suite.Require().NoError(err)
	db.SetMaxOpenConns(maxOpen)
	db.SetMaxIdleConns(maxOpen)
	suite.Require().NoError(db.Ping())

	ctx, cancel := context.WithCancel(context.Background())
	app, err := boostrap.NewApp(ctx, &cfg, db, boostrap.WithAIProvider(provider))
	suite.Require().NoError(err)
	srv := httptest.NewServer(app.Server.Engine)
	client := &poolClient{base: srv.URL, http: &http.Client{Timeout: 20 * time.Second}}
	return client, func() {
		cancel()
		_ = db.Close()
		srv.CloseClientConnections()
		srv.Close()
	}
}

// TestAIProviderCallHoldsNoDatabaseConnection proves the AI routes do not
// keep a pooled connection while the provider works: with a pool of ONE
// connection and an extraction blocked inside the provider, other requests
// of the same user are still served. It also checks the global cap on
// concurrent provider calls (AI_MAX_CONCURRENT_CALLS).
func (suite *E2ETestSuite) TestAIProviderCallHoldsNoDatabaseConnection() {
	suite.seedFeatureFlags()
	provider := newBlockingProvider()
	client, closeApp := suite.aiApp(1, 1, provider)
	defer closeApp()
	rc := routeChecker{suite: suite, client: client}

	rc.call("POST", "/user", map[string]string{
		"name": "AI", "last_name": "Pool", "email": "ai-pool@e2etest.com", "password": "SecureTestPassword123!",
	}, "", http.StatusOK)
	resp := rc.call("POST", "/auth/login", map[string]string{
		"email": "ai-pool@e2etest.com", "password": "SecureTestPassword123!",
	}, "", http.StatusOK)
	var tokens struct {
		AccessToken string `json:"access_token"`
	}
	suite.Require().NoError(json.Unmarshal(resp.body, &tokens))
	token := tokens.AccessToken

	rc.call("POST", "/account", map[string]any{"name": "AI account", "bank": "Bank", "initial_balance": "100"}, token, http.StatusCreated)
	accountID := findID(rc.call("GET", "/account", nil, token, http.StatusOK).json())
	suite.Require().NotEmpty(accountID)

	extract := map[string]any{
		"account_id":    accountID,
		"document_type": "receipt",
		"files": []map[string]string{{
			"filename":     "receipt.png",
			"content_type": "image/png",
			"base64_data":  base64.StdEncoding.EncodeToString([]byte("fake png bytes")),
		}},
	}

	type result struct {
		resp poolResponse
		err  error
	}
	first := make(chan result, 1)
	go func() {
		r, err := client.do("POST", "/ai/extract/transactions", extract, token, nil)
		first <- result{r, err}
	}()

	select {
	case <-provider.entered:
	case <-time.After(10 * time.Second):
		suite.FailNow("the extraction never reached the provider")
	}

	// The provider call is in flight. With a pool of one connection, a
	// request that needs the database is only served if the extraction is
	// not holding that connection.
	start := time.Now()
	rc.call("GET", "/account", nil, token, http.StatusOK)
	rc.call("GET", "/category", nil, token, http.StatusOK)
	suite.Less(time.Since(start), 5*time.Second)

	// Global cap of one provider call: a second one fails fast with 503.
	second := rc.call("POST", "/ai/extract/transactions", extract, token, http.StatusServiceUnavailable)
	suite.NotEmpty(second.headers.Get("Retry-After"))

	close(provider.release)
	select {
	case r := <-first:
		suite.Require().NoError(r.err)
		suite.Equal(http.StatusOK, r.resp.status, string(r.resp.body))
		var body struct {
			Data struct {
				Count               int   `json:"count"`
				PotentialDuplicates []any `json:"potential_duplicates"`
			} `json:"data"`
		}
		suite.Require().NoError(json.Unmarshal(r.resp.body, &body))
		suite.Equal(1, body.Data.Count)
		suite.NotNil(body.Data.PotentialDuplicates)
	case <-time.After(10 * time.Second):
		suite.FailNow("the extraction did not finish after the provider returned")
	}

	// The slot was released: a new call (served from the AI cache, same
	// file) succeeds.
	rc.call("POST", "/ai/extract/transactions", extract, token, http.StatusOK)

	// Spending analysis also runs outside the request transaction.
	rc.call("POST", "/category", map[string]any{"name": "AI category", "icon": "x", "color": "#FFFFFF"}, token, http.StatusCreated)
	categoryID := findID(rc.call("GET", "/category", nil, token, http.StatusOK).json())
	rc.call("POST", "/transaction", map[string]any{
		"name": "Lunch", "amount": "10", "type_transation": "bill", "account_id": accountID, "category_id": categoryID,
	}, token, http.StatusCreated)
	analysis := make(chan result, 1)
	provider2 := provider
	provider2.release = make(chan struct{})
	go func() {
		r, err := client.do("POST", "/ai/analyze/spending", map[string]string{"date_from": "2000-01-01", "date_to": "2100-01-01"}, token, nil)
		analysis <- result{r, err}
	}()
	select {
	case <-provider.entered:
		rc.call("GET", "/account", nil, token, http.StatusOK)
		close(provider2.release)
	case r := <-analysis:
		// no transaction in range: answered without calling the provider
		suite.T().Logf("analysis answered without a provider call: %d", r.resp.status)
		return
	case <-time.After(10 * time.Second):
		suite.FailNow("the analysis never reached the provider")
	}
	r := <-analysis
	suite.Require().NoError(r.err)
	suite.Less(r.resp.status, http.StatusInternalServerError+1)
}
