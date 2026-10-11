package mcpoauth

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	_ "github.com/lib/pq"
	"github.com/plexusone/omniskill/mcp/oauth2"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/testcontainers/testcontainers-go"
	"github.com/testcontainers/testcontainers-go/modules/postgres"
	"github.com/testcontainers/testcontainers-go/wait"

	migrationsdb "github.com/osmait/gestorDePresupuesto/cmd/api/db"
	"github.com/osmait/gestorDePresupuesto/internal/platform/mcp"
	userRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/user"
	"github.com/osmait/gestorDePresupuesto/internal/platform/utils"
	"github.com/osmait/gestorDePresupuesto/internal/services/auth"
)

// testDSN connects as a role that does NOT bypass row-level security, like a
// production deployment should; testDB is a pool on it.
var (
	testDSN string
	testDB  *sql.DB
)

func TestMain(m *testing.M) {
	gin.SetMode(gin.TestMode)
	ctx := context.Background()
	container, err := postgres.Run(ctx, "postgres:17-alpine",
		postgres.WithDatabase("oauth"),
		postgres.WithUsername("admin"),
		postgres.WithPassword("admin"),
		testcontainers.WithWaitStrategy(wait.ForLog("database system is ready to accept connections").
			WithOccurrence(2).WithStartupTimeout(60*time.Second)),
	)
	if err != nil {
		log.Fatalf("postgres container: %v", err)
	}
	host, _ := container.Host(ctx)
	port, _ := container.MappedPort(ctx, "5432")
	dsn := func(user, pass string) string {
		// binary_parameters=yes: the production DSN setting.
		return fmt.Sprintf("postgres://%s:%s@%s:%s/oauth?sslmode=disable&binary_parameters=yes", user, pass, host, port.Port())
	}
	if err := utils.RunMigrationsFromFS(migrationsdb.Migrations, migrationsdb.MigrationsDir, dsn("admin", "admin")); err != nil {
		log.Fatalf("migrations: %v", err)
	}
	adminDB, err := sql.Open("postgres", dsn("admin", "admin"))
	if err != nil {
		log.Fatalf("open: %v", err)
	}
	for _, stmt := range []string{
		`CREATE ROLE app LOGIN PASSWORD 'app' NOSUPERUSER NOBYPASSRLS`,
		`GRANT USAGE ON SCHEMA public TO app`,
		`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app`,
	} {
		if _, err := adminDB.Exec(stmt); err != nil {
			log.Fatalf("%s: %v", stmt, err)
		}
	}
	_ = adminDB.Close()
	testDSN = dsn("app", "app")
	testDB, err = sql.Open("postgres", testDSN)
	if err != nil {
		log.Fatalf("open: %v", err)
	}

	code := m.Run()
	_ = testDB.Close()
	_ = container.Terminate(ctx)
	os.Exit(code)
}

// newUser stores a user and returns its id and email.
func newUser(t *testing.T) (string, string) {
	t.Helper()
	u := utils.GetNewRandomUser()
	u.Email = "u-" + uuid.NewString() + "@example.com"
	require.NoError(t, userRepo.NewUserRepository(testDB).Save(context.Background(), u))
	return u.Id, u.Email
}

func newClient(t *testing.T, s *Storage, secret string) *oauth2.Client {
	t.Helper()
	c := &oauth2.Client{
		ClientID:                "c-" + uuid.NewString(),
		ClientSecret:            secret,
		ClientName:              "Claude",
		RedirectURIs:            []string{"https://claude.ai/api/mcp/auth_callback"},
		GrantTypes:              []string{"authorization_code", "refresh_token"},
		ResponseTypes:           []string{"code"},
		TokenEndpointAuthMethod: "none",
	}
	if secret != "" {
		c.TokenEndpointAuthMethod = "client_secret_post"
	}
	require.NoError(t, s.CreateClient(c))
	return c
}

func newCode(t *testing.T, s *Storage, clientID, subject string, expiresAt time.Time) string {
	t.Helper()
	code, err := oauth2.GenerateAuthorizationCode()
	require.NoError(t, err)
	require.NoError(t, s.CreateAuthorizationCode(&oauth2.AuthorizationCode{
		Code: code, ClientID: clientID, RedirectURI: "https://claude.ai/api/mcp/auth_callback",
		Scope: "mcp", CodeChallenge: strings.Repeat("c", 43), CodeChallengeMethod: "S256",
		Subject: subject, ExpiresAt: expiresAt,
	}))
	return code
}

func newToken(t *testing.T, s *Storage, clientID, subject string, expiresAt, refreshExpiresAt time.Time) *oauth2.TokenInfo {
	t.Helper()
	access, err := oauth2.GenerateAccessToken()
	require.NoError(t, err)
	refresh, err := oauth2.GenerateRefreshToken()
	require.NoError(t, err)
	tok := &oauth2.TokenInfo{
		AccessToken: access, RefreshToken: refresh, TokenType: "Bearer", ClientID: clientID,
		Subject: subject, Scope: "mcp", ExpiresAt: expiresAt, RefreshExpiresAt: refreshExpiresAt,
	}
	require.NoError(t, s.CreateToken(tok))
	return tok
}

func countRows(t *testing.T, query string, args ...any) int {
	t.Helper()
	var n int
	require.NoError(t, testDB.QueryRow(query, args...).Scan(&n))
	return n
}

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

func TestStorage_Clients(t *testing.T) {
	t.Parallel()
	s := New(testDB)

	t.Run("round trip keeps the secret hashed", func(t *testing.T) {
		t.Parallel()
		c := newClient(t, s, "super-secret")
		got, err := s.GetClient(c.ClientID)
		require.NoError(t, err)
		assert.Equal(t, c.ClientName, got.ClientName)
		assert.Equal(t, c.RedirectURIs, got.RedirectURIs)
		assert.Equal(t, c.GrantTypes, got.GrantTypes)
		assert.Equal(t, c.ResponseTypes, got.ResponseTypes)
		assert.Equal(t, "client_secret_post", got.TokenEndpointAuthMethod)
		assert.Equal(t, HashSecret("super-secret"), got.ClientSecret)
		assert.Zero(t, countRows(t, `SELECT COUNT(*) FROM mcp_oauth_clients WHERE client_secret_hash = $1`, "super-secret"))
	})

	t.Run("public client has no secret", func(t *testing.T) {
		t.Parallel()
		c := newClient(t, s, "")
		got, err := s.GetClient(c.ClientID)
		require.NoError(t, err)
		assert.Empty(t, got.ClientSecret)
	})

	t.Run("unknown client", func(t *testing.T) {
		t.Parallel()
		_, err := s.GetClient("missing")
		assert.ErrorIs(t, err, oauth2.ErrClientNotFound)
	})

	t.Run("delete cascades to codes and tokens", func(t *testing.T) {
		t.Parallel()
		_, email := newUser(t)
		c := newClient(t, s, "")
		code := newCode(t, s, c.ClientID, email, time.Now().Add(time.Hour))
		tok := newToken(t, s, c.ClientID, email, time.Now().Add(time.Hour), time.Now().Add(24*time.Hour))
		require.NoError(t, s.DeleteClient(c.ClientID))
		_, err := s.GetAuthorizationCode(code)
		assert.ErrorIs(t, err, oauth2.ErrCodeNotFound)
		_, err = s.GetToken(tok.AccessToken)
		assert.ErrorIs(t, err, oauth2.ErrTokenNotFound)
	})

	invalid := []struct {
		name   string
		client *oauth2.Client
	}{
		{"no redirect uris", &oauth2.Client{ClientID: "x1"}},
		{"too many redirect uris", &oauth2.Client{ClientID: "x2", RedirectURIs: strings.Split(strings.Repeat("https://a.example/cb,", 11), ",")[:11]}},
		{"oversized redirect uri", &oauth2.Client{ClientID: "x3", RedirectURIs: []string{"https://a.example/" + strings.Repeat("a", 3000)}}},
		{"oversized client id", &oauth2.Client{ClientID: strings.Repeat("x", 200), RedirectURIs: []string{"https://a.example/cb"}}},
	}
	for _, tc := range invalid {
		t.Run("rejects "+tc.name, func(t *testing.T) {
			t.Parallel()
			assert.ErrorIs(t, s.CreateClient(tc.client), ErrInvalidClient)
		})
	}
}

// ---------------------------------------------------------------------------
// Authorization codes
// ---------------------------------------------------------------------------

func TestStorage_AuthorizationCodes(t *testing.T) {
	t.Parallel()
	s := New(testDB)
	_, email := newUser(t)
	c := newClient(t, s, "")

	t.Run("stored by hash, never in plain text", func(t *testing.T) {
		t.Parallel()
		code := newCode(t, s, c.ClientID, email, time.Now().Add(time.Hour))
		assert.Equal(t, 1, countRows(t, `SELECT COUNT(*) FROM mcp_oauth_authorization_codes WHERE code_hash = $1`, HashSecret(code)))
		assert.Zero(t, countRows(t, `SELECT COUNT(*) FROM mcp_oauth_authorization_codes WHERE code_hash = $1 OR code_challenge = $1`, code))

		got, err := s.GetAuthorizationCode(code)
		require.NoError(t, err)
		assert.Equal(t, code, got.Code)
		assert.Equal(t, c.ClientID, got.ClientID)
		assert.Equal(t, email, got.Subject)
		assert.Equal(t, "S256", got.CodeChallengeMethod)
	})

	t.Run("single use under concurrency", func(t *testing.T) {
		t.Parallel()
		code := newCode(t, s, c.ClientID, email, time.Now().Add(time.Hour))

		const workers = 12
		var wg sync.WaitGroup
		errs := make([]error, workers)
		start := make(chan struct{})
		for i := 0; i < workers; i++ {
			wg.Add(1)
			go func(i int) {
				defer wg.Done()
				<-start
				errs[i] = s.MarkAuthorizationCodeUsed(code)
			}(i)
		}
		close(start)
		wg.Wait()

		wins := 0
		for _, err := range errs {
			if err == nil {
				wins++
				continue
			}
			assert.ErrorIs(t, err, oauth2.ErrCodeUsed)
		}
		assert.Equal(t, 1, wins, "exactly one exchange may consume the code")
		_, err := s.GetAuthorizationCode(code)
		assert.ErrorIs(t, err, oauth2.ErrCodeUsed)
	})

	t.Run("expired", func(t *testing.T) {
		t.Parallel()
		code := newCode(t, s, c.ClientID, email, time.Now().Add(time.Hour))
		later := &Storage{db: testDB, now: func() time.Time { return time.Now().Add(2 * time.Hour) }}
		_, err := later.GetAuthorizationCode(code)
		assert.ErrorIs(t, err, oauth2.ErrCodeExpired)
		assert.ErrorIs(t, later.MarkAuthorizationCodeUsed(code), oauth2.ErrCodeExpired)
	})

	t.Run("unknown and deleted", func(t *testing.T) {
		t.Parallel()
		_, err := s.GetAuthorizationCode("missing")
		assert.ErrorIs(t, err, oauth2.ErrCodeNotFound)
		assert.ErrorIs(t, s.MarkAuthorizationCodeUsed("missing"), oauth2.ErrCodeNotFound)

		code := newCode(t, s, c.ClientID, email, time.Now().Add(time.Hour))
		require.NoError(t, s.DeleteAuthorizationCode(code))
		_, err = s.GetAuthorizationCode(code)
		assert.ErrorIs(t, err, oauth2.ErrCodeNotFound)
	})
}

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

func TestStorage_Tokens(t *testing.T) {
	t.Parallel()
	s := New(testDB)
	c := newClient(t, s, "")

	t.Run("lookup by hash", func(t *testing.T) {
		t.Parallel()
		userID, email := newUser(t)
		tok := newToken(t, s, c.ClientID, email, time.Now().Add(time.Hour), time.Now().Add(24*time.Hour))

		assert.Equal(t, 1, countRows(t, `SELECT COUNT(*) FROM mcp_oauth_tokens
			WHERE access_token_hash = $1 AND refresh_token_hash = $2 AND user_id = $3`,
			HashSecret(tok.AccessToken), HashSecret(tok.RefreshToken), userID))
		assert.Zero(t, countRows(t, `SELECT COUNT(*) FROM mcp_oauth_tokens
			WHERE access_token_hash IN ($1, $2) OR refresh_token_hash IN ($1, $2)`, tok.AccessToken, tok.RefreshToken))

		got, err := s.GetToken(tok.AccessToken)
		require.NoError(t, err)
		assert.Equal(t, email, got.Subject)
		assert.Equal(t, c.ClientID, got.ClientID)
		assert.Equal(t, "mcp", got.Scope)
		assert.Equal(t, "Bearer", got.TokenType)

		_, err = s.GetToken(tok.RefreshToken)
		assert.ErrorIs(t, err, oauth2.ErrTokenNotFound, "a refresh token is not an access token")
		_, err = s.GetToken("missing")
		assert.ErrorIs(t, err, oauth2.ErrTokenNotFound)
	})

	t.Run("expired access token", func(t *testing.T) {
		t.Parallel()
		_, email := newUser(t)
		tok := newToken(t, s, c.ClientID, email, time.Now().Add(time.Hour), time.Now().Add(24*time.Hour))
		later := &Storage{db: testDB, now: func() time.Time { return time.Now().Add(2 * time.Hour) }}
		_, err := later.GetToken(tok.AccessToken)
		assert.ErrorIs(t, err, oauth2.ErrTokenExpired)
	})

	t.Run("refresh token is consumed once, even concurrently", func(t *testing.T) {
		t.Parallel()
		_, email := newUser(t)
		tok := newToken(t, s, c.ClientID, email, time.Now().Add(time.Hour), time.Now().Add(24*time.Hour))

		const workers = 8
		var wg sync.WaitGroup
		results := make([]error, workers)
		for i := 0; i < workers; i++ {
			wg.Add(1)
			go func(i int) {
				defer wg.Done()
				got, err := s.GetTokenByRefresh(tok.RefreshToken)
				if err == nil && got.Subject != email {
					err = errors.New("wrong subject")
				}
				results[i] = err
			}(i)
		}
		wg.Wait()
		wins := 0
		for _, err := range results {
			if err == nil {
				wins++
			} else {
				assert.ErrorIs(t, err, oauth2.ErrTokenNotFound)
			}
		}
		assert.Equal(t, 1, wins)
		_, err := s.GetToken(tok.AccessToken)
		assert.ErrorIs(t, err, oauth2.ErrTokenNotFound, "rotating the refresh token revokes its access token")
	})

	t.Run("expired refresh token", func(t *testing.T) {
		t.Parallel()
		_, email := newUser(t)
		tok := newToken(t, s, c.ClientID, email, time.Now().Add(time.Hour), time.Now().Add(2*time.Hour))
		later := &Storage{db: testDB, now: func() time.Time { return time.Now().Add(3 * time.Hour) }}
		_, err := later.GetTokenByRefresh(tok.RefreshToken)
		assert.ErrorIs(t, err, oauth2.ErrTokenExpired)
	})

	t.Run("deleted or unknown user cannot use a token", func(t *testing.T) {
		t.Parallel()
		userID, email := newUser(t)
		tok := newToken(t, s, c.ClientID, email, time.Now().Add(time.Hour), time.Now().Add(24*time.Hour))
		_, err := testDB.Exec(`UPDATE users SET deleted_at = NOW() WHERE id = $1`, userID)
		require.NoError(t, err)
		_, err = s.GetToken(tok.AccessToken)
		assert.ErrorIs(t, err, oauth2.ErrTokenNotFound)
		_, err = s.GetTokenByRefresh(tok.RefreshToken)
		assert.ErrorIs(t, err, oauth2.ErrTokenNotFound)

		ghost := newToken(t, s, c.ClientID, "nobody@example.com", time.Now().Add(time.Hour), time.Now().Add(24*time.Hour))
		_, err = s.GetToken(ghost.AccessToken)
		assert.ErrorIs(t, err, oauth2.ErrTokenNotFound)
	})

	t.Run("delete by access token and by client", func(t *testing.T) {
		t.Parallel()
		_, email := newUser(t)
		other := newClient(t, s, "")
		a := newToken(t, s, other.ClientID, email, time.Now().Add(time.Hour), time.Now().Add(24*time.Hour))
		b := newToken(t, s, other.ClientID, email, time.Now().Add(time.Hour), time.Now().Add(24*time.Hour))
		require.NoError(t, s.DeleteToken(a.AccessToken))
		_, err := s.GetToken(a.AccessToken)
		assert.ErrorIs(t, err, oauth2.ErrTokenNotFound)
		_, err = s.GetToken(b.AccessToken)
		require.NoError(t, err)
		require.NoError(t, s.DeleteTokensByClient(other.ClientID))
		_, err = s.GetToken(b.AccessToken)
		assert.ErrorIs(t, err, oauth2.ErrTokenNotFound)
		assert.NoError(t, s.DeleteToken(""))
	})
}

// TestStorage_ExpiryCleanup is deliberately not parallel: it purges by time,
// so it runs while no other test of this package is creating rows.
func TestStorage_ExpiryCleanup(t *testing.T) {
	now := time.Now()
	s := New(testDB)
	_, email := newUser(t)
	c := newClient(t, s, "")

	expiredCode := newCode(t, s, c.ClientID, email, now.Add(time.Minute))
	liveCode := newCode(t, s, c.ClientID, email, now.Add(time.Hour))
	deadToken := newToken(t, s, c.ClientID, email, now.Add(time.Minute), now.Add(2*time.Minute))
	// Access token expired but refresh token still valid: must be kept.
	refreshable := newToken(t, s, c.ClientID, email, now.Add(time.Minute), now.Add(24*time.Hour))

	later := &Storage{db: testDB, now: func() time.Time { return now.Add(30 * time.Minute) }}
	n, err := later.Cleanup(context.Background())
	require.NoError(t, err)
	assert.GreaterOrEqual(t, n, int64(2))

	assert.Zero(t, countRows(t, `SELECT COUNT(*) FROM mcp_oauth_authorization_codes WHERE code_hash = $1`, HashSecret(expiredCode)))
	assert.Equal(t, 1, countRows(t, `SELECT COUNT(*) FROM mcp_oauth_authorization_codes WHERE code_hash = $1`, HashSecret(liveCode)))
	assert.Zero(t, countRows(t, `SELECT COUNT(*) FROM mcp_oauth_tokens WHERE access_token_hash = $1`, HashSecret(deadToken.AccessToken)))
	got, err := later.GetTokenByRefresh(refreshable.RefreshToken)
	require.NoError(t, err)
	assert.Equal(t, email, got.Subject)

	// Writes purge on their own too.
	stale := newCode(t, s, c.ClientID, email, now.Add(time.Minute))
	newCode(t, later, c.ClientID, email, now.Add(2*time.Hour))
	assert.Zero(t, countRows(t, `SELECT COUNT(*) FROM mcp_oauth_authorization_codes WHERE code_hash = $1`, HashSecret(stale)))
}

func TestStorage_SurvivesRestart(t *testing.T) {
	t.Parallel()
	_, email := newUser(t)
	before := New(testDB)
	c := newClient(t, before, "s3cret")
	tok := newToken(t, before, c.ClientID, email, time.Now().Add(time.Hour), time.Now().Add(24*time.Hour))
	code := newCode(t, before, c.ClientID, email, time.Now().Add(time.Hour))

	// A new process: new pool, new storage instance.
	db, err := sql.Open("postgres", testDSN)
	require.NoError(t, err)
	t.Cleanup(func() { _ = db.Close() })
	after := New(db)

	gotClient, err := after.GetClient(c.ClientID)
	require.NoError(t, err)
	assert.Equal(t, c.RedirectURIs, gotClient.RedirectURIs)
	gotToken, err := after.GetToken(tok.AccessToken)
	require.NoError(t, err)
	assert.Equal(t, email, gotToken.Subject)
	_, err = after.GetAuthorizationCode(code)
	require.NoError(t, err)
}

// ---------------------------------------------------------------------------
// Full OAuth flow on PostgreSQL (DCR with a client secret, PKCE, restart)
// ---------------------------------------------------------------------------

// passwordAuthenticator accepts any known email with password "pw".
type passwordAuthenticator struct{}

func (passwordAuthenticator) Authenticate(_ context.Context, _, password, _ string) error {
	if password == "pw" {
		return nil
	}
	return auth.ErrInvalidCredentials
}

func newProviderEngine(t *testing.T, db *sql.DB) (*mcp.OAuthProvider, *gin.Engine) {
	t.Helper()
	p, err := mcp.NewOAuthProvider(mcp.OAuthConfig{
		Issuer:        "https://api.example.com",
		Authenticator: passwordAuthenticator{},
		Storage:       New(db),
	})
	require.NoError(t, err)
	e := gin.New()
	e.GET("/oauth/authorize", p.AuthorizeHandler())
	e.POST("/oauth/authorize", p.AuthorizeHandler())
	e.POST("/oauth/token", gin.WrapH(p.TokenHandler()))
	e.POST("/oauth/revoke", gin.WrapH(p.RevocationHandler()))
	e.POST("/oauth/register", gin.WrapH(p.RegistrationHandler()))
	return p, e
}

func serve(e *gin.Engine, req *http.Request) *httptest.ResponseRecorder {
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)
	return rec
}

func form(path string, v url.Values) *http.Request {
	req := httptest.NewRequest(http.MethodPost, path, strings.NewReader(v.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	return req
}

func TestOAuthFlow_PostgresAcrossRestart(t *testing.T) {
	t.Parallel()
	_, email := newUser(t)
	const redirectURI = "https://claude.ai/api/mcp/auth_callback"
	_, engine := newProviderEngine(t, testDB)

	// Dynamic client registration of a confidential client.
	reg := httptest.NewRequest(http.MethodPost, "/oauth/register", strings.NewReader(
		`{"client_name":"Claude","redirect_uris":["`+redirectURI+`"],"token_endpoint_auth_method":"client_secret_post","grant_types":["authorization_code","refresh_token"]}`))
	reg.Header.Set("Content-Type", "application/json")
	regRec := serve(engine, reg)
	require.Equal(t, http.StatusCreated, regRec.Code, regRec.Body.String())
	var client struct {
		ClientID     string `json:"client_id"`
		ClientSecret string `json:"client_secret"`
	}
	require.NoError(t, json.Unmarshal(regRec.Body.Bytes(), &client))
	require.NotEmpty(t, client.ClientSecret)
	assert.Zero(t, countRows(t, `SELECT COUNT(*) FROM mcp_oauth_clients WHERE client_secret_hash = $1`, client.ClientSecret))

	verifier, err := oauth2.GenerateCodeVerifier()
	require.NoError(t, err)
	authForm := url.Values{
		"client_id": {client.ClientID}, "redirect_uri": {redirectURI}, "state": {"st"}, "scope": {"mcp"},
		"code_challenge": {oauth2.GenerateCodeChallenge(verifier)}, "code_challenge_method": {"S256"},
		"username": {email}, "password": {"pw"}, "action": {"approve"},
	}
	authRec := serve(engine, form("/oauth/authorize", authForm))
	require.Equal(t, http.StatusSeeOther, authRec.Code, authRec.Body.String())
	loc, err := url.Parse(authRec.Header().Get("Location"))
	require.NoError(t, err)
	code := loc.Query().Get("code")
	require.NotEmpty(t, code)

	exchange := func(e *gin.Engine, secret string) *httptest.ResponseRecorder {
		return serve(e, form("/oauth/token", url.Values{
			"grant_type": {"authorization_code"}, "code": {code}, "redirect_uri": {redirectURI},
			"client_id": {client.ClientID}, "client_secret": {secret}, "code_verifier": {verifier},
		}))
	}
	assert.Equal(t, http.StatusUnauthorized, exchange(engine, "wrong-secret").Code)
	// A stored hash presented as the secret is rejected too (it gets hashed again).
	assert.Equal(t, http.StatusUnauthorized, exchange(engine, HashSecret(client.ClientSecret)).Code)
	tokenRec := exchange(engine, client.ClientSecret)
	require.Equal(t, http.StatusOK, tokenRec.Code, tokenRec.Body.String())
	var tokens struct {
		AccessToken  string `json:"access_token"`
		RefreshToken string `json:"refresh_token"`
	}
	require.NoError(t, json.Unmarshal(tokenRec.Body.Bytes(), &tokens))

	// Redeploy: new pool, new provider, same database.
	db, err := sql.Open("postgres", testDSN)
	require.NoError(t, err)
	t.Cleanup(func() { _ = db.Close() })
	restarted, restartedEngine := newProviderEngine(t, db)

	info, err := restarted.TokenVerifier()(tokens.AccessToken)
	require.NoError(t, err, "Claude stays connected after a redeploy")
	assert.Equal(t, email, info.Subject)

	assert.Equal(t, http.StatusBadRequest, exchange(restartedEngine, client.ClientSecret).Code, "codes stay single-use across restarts")

	refreshRec := serve(restartedEngine, form("/oauth/token", url.Values{
		"grant_type": {"refresh_token"}, "refresh_token": {tokens.RefreshToken}, "client_id": {client.ClientID},
	}))
	require.Equal(t, http.StatusOK, refreshRec.Code, refreshRec.Body.String())
	replay := serve(restartedEngine, form("/oauth/token", url.Values{
		"grant_type": {"refresh_token"}, "refresh_token": {tokens.RefreshToken}, "client_id": {client.ClientID},
	}))
	assert.Equal(t, http.StatusBadRequest, replay.Code, "a rotated refresh token cannot be reused")

	// Revocation (RFC 7009) authenticates the confidential client with the
	// hashed secret, like the token endpoint.
	var refreshed struct {
		AccessToken string `json:"access_token"`
	}
	require.NoError(t, json.Unmarshal(refreshRec.Body.Bytes(), &refreshed))
	revoke := func(secret string) *httptest.ResponseRecorder {
		return serve(restartedEngine, form("/oauth/revoke", url.Values{
			"token": {refreshed.AccessToken}, "client_id": {client.ClientID}, "client_secret": {secret},
		}))
	}
	assert.Equal(t, http.StatusUnauthorized, revoke("wrong-secret").Code)
	_, err = restarted.TokenVerifier()(refreshed.AccessToken)
	require.NoError(t, err, "a rejected revocation leaves the token valid")
	require.Equal(t, http.StatusOK, revoke(client.ClientSecret).Code)
	_, err = restarted.TokenVerifier()(refreshed.AccessToken)
	assert.Error(t, err, "a revoked access token is rejected")
}
