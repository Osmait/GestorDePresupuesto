package mcp

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	domainapikey "github.com/osmait/gestorDePresupuesto/internal/domain/apikey"
	apikeyrepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/apikey"
	"github.com/osmait/gestorDePresupuesto/internal/services/apikey"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// mockAPIKeyRepo is a minimal in-memory implementation of APIKeyRepositoryInterface
// used to avoid a real database in middleware tests.
type mockAPIKeyRepo struct {
	// keys maps key_hash → *APIKey; only FindByKeyHash and UpdateLastUsed are exercised.
	keys map[string]*domainapikey.APIKey
}

func (m *mockAPIKeyRepo) Save(_ context.Context, key *domainapikey.APIKey) error {
	m.keys[key.KeyHash] = key
	return nil
}

func (m *mockAPIKeyRepo) FindByKeyHash(_ context.Context, keyHash string) (*domainapikey.APIKey, error) {
	k, ok := m.keys[keyHash]
	if !ok {
		return nil, sql.ErrNoRows
	}
	return k, nil
}

func (m *mockAPIKeyRepo) FindByUserID(_ context.Context, _ string) ([]*domainapikey.APIKey, error) {
	return nil, nil
}

func (m *mockAPIKeyRepo) FindByID(_ context.Context, _ string) (*domainapikey.APIKey, error) {
	return nil, nil
}

func (m *mockAPIKeyRepo) UpdateLastUsed(_ context.Context, _ string) error {
	// best-effort; no-op in tests
	return nil
}

func (m *mockAPIKeyRepo) Delete(_ context.Context, _, _ string) error {
	return nil
}

// compile-time assertion that mockAPIKeyRepo satisfies the repository interface.
var _ apikeyrepo.APIKeyRepositoryInterface = (*mockAPIKeyRepo)(nil)

// hashToken returns the hex-encoded SHA-256 of the given raw token string,
// mirroring the hash logic used by APIKeyService.ValidateKey.
func hashToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

// newTestRouter builds a Gin engine (test mode) with APIKeyAuthMiddleware installed
// and a single GET /protected handler that echoes the resolved user ID.
func newTestRouter(svc *apikey.APIKeyService) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(APIKeyAuthMiddleware(svc))
	r.GET("/protected", func(c *gin.Context) {
		userID, _ := c.Get("X-User-Id")
		c.JSON(http.StatusOK, gin.H{"user_id": userID})
	})
	return r
}

// TestAPIKeyAuthMiddleware_MissingAuthorizationHeader verifies that a request
// with no Authorization header is rejected with 401 "missing API key".
func TestAPIKeyAuthMiddleware_MissingAuthorizationHeader(t *testing.T) {
	repo := &mockAPIKeyRepo{keys: map[string]*domainapikey.APIKey{}}
	svc := apikey.NewAPIKeyService(repo)
	r := newTestRouter(svc)

	w := httptest.NewRecorder()
	req, err := http.NewRequest(http.MethodGet, "/protected", nil)
	require.NoError(t, err)

	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
	assert.Contains(t, w.Body.String(), "missing API key")
}

// TestAPIKeyAuthMiddleware_NoBearerPrefix verifies that a header value without
// the "Bearer " prefix is treated the same as a missing key.
func TestAPIKeyAuthMiddleware_NoBearerPrefix(t *testing.T) {
	repo := &mockAPIKeyRepo{keys: map[string]*domainapikey.APIKey{}}
	svc := apikey.NewAPIKeyService(repo)
	r := newTestRouter(svc)

	w := httptest.NewRecorder()
	req, err := http.NewRequest(http.MethodGet, "/protected", nil)
	require.NoError(t, err)
	req.Header.Set("Authorization", "some-raw-token-without-prefix")

	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
	assert.Contains(t, w.Body.String(), "missing API key")
}

// TestAPIKeyAuthMiddleware_InvalidToken verifies that a Bearer token that does
// not match any stored key is rejected with 401 "invalid API key".
func TestAPIKeyAuthMiddleware_InvalidToken(t *testing.T) {
	repo := &mockAPIKeyRepo{keys: map[string]*domainapikey.APIKey{}}
	svc := apikey.NewAPIKeyService(repo)
	r := newTestRouter(svc)

	w := httptest.NewRecorder()
	req, err := http.NewRequest(http.MethodGet, "/protected", nil)
	require.NoError(t, err)
	req.Header.Set("Authorization", "Bearer unknown-token-xyz")

	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusUnauthorized, w.Code)
	assert.Contains(t, w.Body.String(), "invalid API key")
}

// TestAPIKeyAuthMiddleware_ValidToken verifies that a Bearer token matching a
// stored, active, non-expired key is accepted: the middleware sets X-User-Id in
// the Gin context and the next handler returns 200.
func TestAPIKeyAuthMiddleware_ValidToken(t *testing.T) {
	const (
		rawToken = "sk_live_test_token_for_middleware_test_12345"
		userID   = "user-test-42"
		keyID    = "key-id-1"
	)

	key := domainapikey.NewAPIKey(keyID, userID, "test-key", hashToken(rawToken), rawToken[:12])
	// IsActive is set to true by NewAPIKey; ExpiresAt is nil (never expires).

	repo := &mockAPIKeyRepo{
		keys: map[string]*domainapikey.APIKey{
			hashToken(rawToken): key,
		},
	}
	svc := apikey.NewAPIKeyService(repo)
	r := newTestRouter(svc)

	w := httptest.NewRecorder()
	req, err := http.NewRequest(http.MethodGet, "/protected", nil)
	require.NoError(t, err)
	req.Header.Set("Authorization", "Bearer "+rawToken)

	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), userID)
}
