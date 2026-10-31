package mcp

import (
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/plexusone/omniskill/mcp/oauth2"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/osmait/gestorDePresupuesto/internal/config"
)

func TestGrantedScope(t *testing.T) {
	t.Parallel()
	for _, tc := range []struct{ requested, access, want string }{
		{"mcp", "", "mcp"},
		{"mcp", accessFull, "mcp"},
		{"mcp", accessRead, "mcp mcp:read"},
		{"", accessRead, "mcp:read"},
		{"mcp:read mcp:write", accessRead, "mcp:read"},
		{"mcp:write offline_access", accessRead, "offline_access mcp:read"},
		// Never widened: a read-only request stays read-only.
		{"mcp:read", accessFull, "mcp:read"},
		{"mcp:read", "anything", "mcp:read"},
	} {
		got := grantedScope(tc.requested, tc.access)
		assert.Equal(t, tc.want, got, "%q + %q", tc.requested, tc.access)
		if tc.access == accessRead {
			assert.True(t, isReadOnlyScope(got), "%q is read-only", got)
		}
	}
}

func TestRedirectAllowlist(t *testing.T) {
	t.Parallel()
	allow := newRedirectAllowlist([]string{" Example.COM ", "https://partner.example/cb", ""})
	for uri, want := range map[string]bool{
		"https://claude.ai/api/mcp/auth_callback":  true,
		"https://CLAUDE.com/api/mcp/auth_callback": true,
		"https://example.com/cb":                   true,
		"https://partner.example/other":            true,
		"http://localhost:6274/oauth/callback":     true,
		"http://127.0.0.1:33418/callback":          true,
		"http://[::1]:8080/cb":                     true,
		"http://claude.ai/api/mcp/auth_callback":   false, // plain http off loopback
		"https://claude.ai.evil.example/cb":        false,
		"https://evil.example/claude.ai":           false,
		"https://user@claude.ai/cb":                false,
		"cursor://anysphere.cursor-mcp/oauth/cb":   false,
		"/relative/callback":                       false,
		"":                                         false,
	} {
		assert.Equal(t, want, allow.trusted(uri), uri)
	}
	assert.False(t, newRedirectAllowlist(nil).trusted("https://example.com/cb"))
}

// The consent page shows the access level and lets the user downgrade a full
// access request to read-only; the code (and so the token) then carries
// mcp:read. A read-only request offers no choice.
func TestAuthorizePage_AccessLevel(t *testing.T) {
	t.Parallel()
	f := newOAuthFixture(t, &fakeAuthenticator{}, config.ServerConfig{})

	t.Run("full access request: choice, full preselected", func(t *testing.T) {
		_, challenge := newPKCE(t)
		body := f.do(getAuthorize(authorizeQuery(challenge), "")).Body.String()
		assert.Contains(t, body, "<legend>Nivel de acceso</legend>")
		assert.Contains(t, body, `name="access" value="full" checked`)
		assert.Contains(t, body, `name="access" value="read">`)
		assert.Contains(t, body, "Podrá hacer cambios")
		assert.NotContains(t, body, `id="redirect-warning"`, "claude.ai is a known redirect host")

		en := f.do(getAuthorize(authorizeQuery(challenge), "en")).Body.String()
		assert.Contains(t, en, "<legend>Access level</legend>")
		assert.Contains(t, en, "Read-only")
	})

	t.Run("read-only request: stated, no choice, no write list", func(t *testing.T) {
		_, challenge := newPKCE(t)
		q := authorizeQuery(challenge)
		q.Set("scope", ScopeRead)
		body := f.do(getAuthorize(q, "")).Body.String()
		assert.Contains(t, body, "Esta conexión pidió acceso de solo lectura")
		assert.NotContains(t, body, `name="access"`)
		assert.NotContains(t, body, "Podrá hacer cambios")
	})

	t.Run("downgrade to read-only issues a read-only token", func(t *testing.T) {
		verifier, challenge := newPKCE(t)
		form := loginForm(challenge, testEmail, testPassword, "approve")
		form.Set("access", accessRead)
		rec := f.do(postForm("/oauth/authorize", form, ""))
		require.Equal(t, http.StatusSeeOther, rec.Code, rec.Body.String())
		loc, err := url.Parse(rec.Header().Get("Location"))
		require.NoError(t, err)
		_, tokens := exchangeCode(t, f, loc.Query().Get("code"), verifier)
		info, err := f.provider.TokenVerifier()(tokens.AccessToken)
		require.NoError(t, err)
		assert.True(t, isReadOnlyScope(info.Scope), "scope %q", info.Scope)
	})

	t.Run("full access keeps the requested scope", func(t *testing.T) {
		verifier, challenge := newPKCE(t)
		form := loginForm(challenge, testEmail, testPassword, "approve")
		form.Set("access", accessFull)
		rec := f.do(postForm("/oauth/authorize", form, ""))
		require.Equal(t, http.StatusSeeOther, rec.Code)
		loc, _ := url.Parse(rec.Header().Get("Location"))
		_, tokens := exchangeCode(t, f, loc.Query().Get("code"), verifier)
		info, err := f.provider.TokenVerifier()(tokens.AccessToken)
		require.NoError(t, err)
		assert.Equal(t, "mcp", info.Scope)
	})

	t.Run("the choice survives a failed attempt", func(t *testing.T) {
		_, challenge := newPKCE(t)
		form := loginForm(challenge, testEmail, "wrong", "approve")
		form.Set("access", accessRead)
		body := f.do(postForm("/oauth/authorize", form, "")).Body.String()
		assert.Contains(t, body, `name="access" value="read" checked`)
		assert.Contains(t, body, `class="write is-off"`)
	})
}

// A client whose redirect host is not a known one gets a prominent warning;
// MCP_TRUSTED_REDIRECT_HOSTS adds hosts. Everything is escaped.
func TestAuthorizePage_UnknownRedirectHostWarning(t *testing.T) {
	t.Parallel()
	f := newOAuthFixture(t, &fakeAuthenticator{}, config.ServerConfig{})
	for _, c := range []*oauth2.Client{
		{ClientID: "evil", ClientName: `Claude"><b>`, RedirectURIs: []string{"https://claude-ai.evil.example/cb"}},
		{ClientID: "native", ClientName: "Cursor", RedirectURIs: []string{"cursor://anysphere.cursor-mcp/oauth/callback"}},
		{ClientID: "local", ClientName: "Inspector", RedirectURIs: []string{"http://localhost:6274/oauth/callback"}},
	} {
		require.NoError(t, f.storage.CreateClient(c))
	}
	page := func(clientID, redirect, lang string) string {
		_, challenge := newPKCE(t)
		q := authorizeQuery(challenge)
		q.Set("client_id", clientID)
		q.Set("redirect_uri", redirect)
		rec := f.do(getAuthorize(q, lang))
		require.Equal(t, http.StatusOK, rec.Code)
		return rec.Body.String()
	}

	body := page("evil", "https://claude-ai.evil.example/cb", "")
	assert.Contains(t, body, `id="redirect-warning"`)
	assert.Contains(t, body, "Dirección de retorno desconocida")
	assert.Contains(t, body, "claude-ai.evil.example no es una dirección conocida de Claude")
	assert.Contains(t, body, "<strong>claude-ai.evil.example</strong>")
	assert.NotContains(t, body, `"><b>`)

	en := page("native", "cursor://anysphere.cursor-mcp/oauth/callback", "en")
	assert.Contains(t, en, "Unknown return address")
	assert.Contains(t, en, "cursor://anysphere.cursor-mcp is not a known Claude address")

	assert.NotContains(t, page("local", "http://localhost:6274/oauth/callback", ""), `id="redirect-warning"`)

	// A configured host is trusted.
	trusting, err := NewOAuthProvider(OAuthConfig{
		Issuer: "https://api.example.com", Authenticator: &fakeAuthenticator{}, Storage: f.storage,
		TrustedRedirectHosts: []string{"claude-ai.evil.example"},
	})
	require.NoError(t, err)
	_, challenge := newPKCE(t)
	q := authorizeQuery(challenge)
	q.Set("client_id", "evil")
	q.Set("redirect_uri", "https://claude-ai.evil.example/cb")
	rec := httptest.NewRecorder()
	trusting.ServeAuthorize(rec, getAuthorize(q, ""), "203.0.113.1")
	assert.NotContains(t, rec.Body.String(), `id="redirect-warning"`)
}

// MCP_ENFORCE_REDIRECT_ALLOWLIST: dynamic client registration rejects
// redirect URIs outside the allowlist; off by default.
func TestRegistration_RedirectAllowlistEnforcement(t *testing.T) {
	t.Parallel()
	register := func(p *OAuthProvider, redirects string) *httptest.ResponseRecorder {
		req := httptest.NewRequest(http.MethodPost, "/oauth/register",
			strings.NewReader(`{"client_name":"x","redirect_uris":`+redirects+`,"token_endpoint_auth_method":"none"}`))
		req.Header.Set("Content-Type", "application/json")
		rec := httptest.NewRecorder()
		p.RegistrationHandler().ServeHTTP(rec, req)
		return rec
	}
	newProvider := func(enforce bool) *OAuthProvider {
		p, err := NewOAuthProvider(OAuthConfig{
			Issuer: "https://api.example.com", Authenticator: &fakeAuthenticator{},
			EnforceRedirectAllowlist: enforce, TrustedRedirectHosts: []string{"partner.example"},
		})
		require.NoError(t, err)
		return p
	}

	open := newProvider(false)
	assert.Equal(t, http.StatusCreated, register(open, `["https://evil.example/cb"]`).Code)

	strict := newProvider(true)
	rec := register(strict, `["https://claude.ai/api/mcp/auth_callback","https://evil.example/cb"]`)
	assert.Equal(t, http.StatusBadRequest, rec.Code)
	assert.Contains(t, rec.Body.String(), `"error":"invalid_redirect_uri"`)
	assert.Equal(t, http.StatusBadRequest, register(strict, `"not-a-list"`).Code)
	for _, ok := range []string{
		`["https://claude.ai/api/mcp/auth_callback"]`,
		`["https://claude.com/api/mcp/auth_callback","http://127.0.0.1:5555/cb"]`,
		`["https://partner.example/cb"]`,
	} {
		assert.Equal(t, http.StatusCreated, register(strict, ok).Code, ok)
	}
}
