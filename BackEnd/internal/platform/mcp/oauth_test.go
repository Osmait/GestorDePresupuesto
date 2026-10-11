package mcp

import (
	"context"
	"encoding/json"
	"errors"
	"html"
	"net/http"
	"net/http/httptest"
	"net/url"
	"regexp"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/plexusone/mcpkit/oauth2"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/crypto/bcrypt"

	"github.com/osmait/gestorDePresupuesto/internal/config"
	"github.com/osmait/gestorDePresupuesto/internal/domain/user"
	"github.com/osmait/gestorDePresupuesto/internal/platform/server/middleware"
	"github.com/osmait/gestorDePresupuesto/internal/services/auth"
	"github.com/osmait/gestorDePresupuesto/internal/services/errorhttp"
)

const (
	testClientID    = "client-claude"
	testRedirectURI = "https://claude.ai/api/mcp/auth_callback"
	testEmail       = "alice@example.com"
	testPassword    = "right-password"
)

// gin.SetMode writes package globals: set it once, not from parallel tests.
func init() { gin.SetMode(gin.TestMode) }

// fakeAuthenticator accepts testEmail/testPassword and records every call.
type fakeAuthenticator struct {
	mu    sync.Mutex
	calls []authCall
}

type authCall struct{ email, ip string }

func (f *fakeAuthenticator) Authenticate(_ context.Context, email, password, clientIP string) error {
	f.mu.Lock()
	f.calls = append(f.calls, authCall{email: email, ip: clientIP})
	f.mu.Unlock()
	switch password {
	case "locked":
		return &auth.LoginLockedError{RetryAfter: 14*time.Minute + 10*time.Second}
	case "locked-short":
		return &auth.LoginLockedError{RetryAfter: 20 * time.Second}
	case "boom":
		return errors.New("db down")
	}
	if email == testEmail && password == testPassword {
		return nil
	}
	return auth.ErrInvalidCredentials
}

func (f *fakeAuthenticator) Calls() []authCall {
	f.mu.Lock()
	defer f.mu.Unlock()
	return append([]authCall(nil), f.calls...)
}

type oauthFixture struct {
	provider *OAuthProvider
	storage  oauth2.Storage
	auth     Authenticator
	engine   *gin.Engine
}

// newOAuthFixture wires the provider routes on a gin engine the way
// server.registerRoutes does (ConfigureClientIP first).
func newOAuthFixture(t *testing.T, authenticator Authenticator, ipCfg config.ServerConfig) *oauthFixture {
	t.Helper()
	storage := oauth2.NewMemoryStorage()
	require.NoError(t, storage.CreateClient(&oauth2.Client{
		ClientID:                testClientID,
		ClientName:              "Claude",
		RedirectURIs:            []string{testRedirectURI},
		TokenEndpointAuthMethod: "none",
	}))
	p, err := NewOAuthProvider(OAuthConfig{
		Issuer:        "https://api.example.com",
		Authenticator: authenticator,
		Storage:       storage,
	})
	require.NoError(t, err)

	engine := gin.New()
	require.NoError(t, middleware.ConfigureClientIP(engine, ipCfg))
	engine.GET("/oauth/authorize", p.AuthorizeHandler())
	engine.POST("/oauth/authorize", p.AuthorizeHandler())
	engine.POST("/oauth/token", gin.WrapH(p.TokenHandler()))
	engine.POST("/oauth/register", gin.WrapH(p.RegistrationHandler()))
	return &oauthFixture{provider: p, storage: storage, auth: authenticator, engine: engine}
}

func (f *oauthFixture) do(req *http.Request) *httptest.ResponseRecorder {
	rec := httptest.NewRecorder()
	f.engine.ServeHTTP(rec, req)
	return rec
}

func authorizeQuery(challenge string) url.Values {
	return url.Values{
		"response_type":         {"code"},
		"client_id":             {testClientID},
		"redirect_uri":          {testRedirectURI},
		"state":                 {"state-123"},
		"scope":                 {"mcp"},
		"code_challenge":        {challenge},
		"code_challenge_method": {"S256"},
	}
}

func getAuthorize(q url.Values, acceptLanguage string) *http.Request {
	req := httptest.NewRequest(http.MethodGet, "/oauth/authorize?"+q.Encode(), nil)
	if acceptLanguage != "" {
		req.Header.Set("Accept-Language", acceptLanguage)
	}
	return req
}

// loginForm is the form the page posts: its hidden fields plus credentials.
func loginForm(challenge, email, password, action string) url.Values {
	v := authorizeQuery(challenge)
	v.Del("response_type")
	v.Set("username", email)
	v.Set("password", password)
	if action != "" {
		v.Set("action", action)
	}
	return v
}

func postForm(path string, form url.Values, acceptLanguage string) *http.Request {
	req := httptest.NewRequest(http.MethodPost, path, strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	if acceptLanguage != "" {
		req.Header.Set("Accept-Language", acceptLanguage)
	}
	return req
}

func newPKCE(t *testing.T) (verifier, challenge string) {
	t.Helper()
	verifier, err := oauth2.GenerateCodeVerifier()
	require.NoError(t, err)
	return verifier, oauth2.GenerateCodeChallenge(verifier)
}

func hiddenValue(t *testing.T, body, name string) string {
	t.Helper()
	m := regexp.MustCompile(`name="` + regexp.QuoteMeta(name) + `" value="([^"]*)"`).FindStringSubmatch(body)
	require.NotNil(t, m, "hidden field %s not found", name)
	return html.UnescapeString(m[1])
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

func TestAuthorizePage_LocalizedRenderingAndErrorMapping(t *testing.T) {
	t.Parallel()
	_, challenge := newPKCE(t)

	tests := []struct {
		name           string
		acceptLanguage string
		password       string // "" = GET (no submission)
		email          string
		wantStatus     int
		wantLang       string
		wantContains   []string
		wantAbsent     []string
		wantRetryAfter string
	}{
		{
			name: "GET defaults to Spanish", wantStatus: http.StatusOK, wantLang: "es",
			wantContains: []string{
				"Claude solicita acceso a tu cuenta de SBFinance", "Podrá ver", "Podrá hacer cambios",
				`<label for="username">Correo electrónico</label>`, `autocomplete="username"`,
				`inputmode="email"`, `autocomplete="current-password"`, `aria-pressed="false"`,
				`aria-label="Mostrar contraseña"`, `value="deny" formnovalidate`, "passkey",
				`href="https://presupuesto.saulburgos.com"`, "<strong>claude.ai</strong>",
			},
			wantAbsent: []string{`role="alert"`, "💰", "🔒"},
		},
		{
			name: "GET in English when preferred", acceptLanguage: "en-US,en;q=0.9,es;q=0.8",
			wantStatus: http.StatusOK, wantLang: "en",
			wantContains: []string{"Claude wants to access your SBFinance account", "It will be able to view", `<label for="username">Email</label>`},
			wantAbsent:   []string{"solicita acceso"},
		},
		{
			name: "unsupported language falls back to the next supported one", acceptLanguage: "fr-FR, en;q=0.5",
			wantStatus: http.StatusOK, wantLang: "en",
		},
		{
			name: "invalid credentials (es)", email: testEmail, password: "wrong",
			wantStatus: http.StatusOK, wantLang: "es",
			wantContains: []string{`role="alert"`, "El correo o la contraseña no son correctos.", `aria-invalid="true"`, `value="alice@example.com"`},
			wantAbsent:   []string{"Invalid username or password"},
		},
		{
			name: "invalid credentials (en)", acceptLanguage: "en", email: testEmail, password: "wrong",
			wantStatus: http.StatusOK, wantLang: "en",
			wantContains: []string{`role="alert"`, "The email or password is incorrect."},
		},
		{
			name: "lockout shows the localized wait time", email: testEmail, password: "locked",
			wantStatus: http.StatusTooManyRequests, wantLang: "es", wantRetryAfter: "850",
			wantContains: []string{`role="alert"`, "Demasiados intentos fallidos. Espera 15 minutos e inténtalo de nuevo."},
		},
		{
			name: "lockout under a minute (en)", acceptLanguage: "en", email: testEmail, password: "locked-short",
			wantStatus: http.StatusTooManyRequests, wantLang: "en", wantRetryAfter: "20",
			wantContains: []string{"Too many failed attempts. Wait 1 minute and try again."},
		},
		{
			name: "infrastructure failure is not reported as bad credentials", acceptLanguage: "en", email: testEmail, password: "boom",
			wantStatus: http.StatusInternalServerError, wantLang: "en",
			wantContains: []string{`role="alert"`, "server problem"},
			wantAbsent:   []string{"incorrect", "db down"},
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			f := newOAuthFixture(t, &fakeAuthenticator{}, config.ServerConfig{})
			var req *http.Request
			if tc.password == "" {
				req = getAuthorize(authorizeQuery(challenge), tc.acceptLanguage)
			} else {
				req = postForm("/oauth/authorize", loginForm(challenge, tc.email, tc.password, "approve"), tc.acceptLanguage)
			}
			rec := f.do(req)
			body := rec.Body.String()

			assert.Equal(t, tc.wantStatus, rec.Code)
			assert.Empty(t, rec.Header().Get("Location"))
			assert.Contains(t, body, `<html lang="`+tc.wantLang+`">`)
			assert.Equal(t, tc.wantLang, rec.Header().Get("Content-Language"))
			for _, s := range tc.wantContains {
				assert.Contains(t, body, s)
			}
			for _, s := range tc.wantAbsent {
				assert.NotContains(t, body, s)
			}
			assert.Equal(t, tc.wantRetryAfter, rec.Header().Get("Retry-After"))
			// The OAuth parameters survive a failed attempt.
			assert.Equal(t, challenge, hiddenValue(t, body, "code_challenge"))
			assert.Equal(t, "state-123", hiddenValue(t, body, "state"))
		})
	}
}

func TestAuthorizePage_EscapesUserControlledInput(t *testing.T) {
	t.Parallel()
	_, challenge := newPKCE(t)
	f := newOAuthFixture(t, &fakeAuthenticator{}, config.ServerConfig{})
	// Dynamic client registration lets anybody choose the client name.
	require.NoError(t, f.storage.CreateClient(&oauth2.Client{
		ClientID:     "evil",
		ClientName:   `<script>alert("name")</script>`,
		RedirectURIs: []string{testRedirectURI},
	}))

	form := loginForm(challenge, `"><img src=x onerror=alert(1)>`, "wrong", "approve")
	form.Set("client_id", "evil")
	form.Set("state", `"><script>alert("state")</script>`)
	form.Set("scope", `mcp" autofocus onfocus="alert(1)`)
	rec := f.do(postForm("/oauth/authorize", form, ""))
	body := rec.Body.String()

	require.Equal(t, http.StatusOK, rec.Code)
	for _, raw := range []string{`<script>alert(`, `<img src=x`, `" autofocus onfocus="`, `"><script>`} {
		assert.NotContains(t, body, raw)
	}
	assert.Contains(t, body, "&lt;script&gt;alert(&#34;name&#34;)&lt;/script&gt; solicita acceso")
	assert.Equal(t, `"><script>alert("state")</script>`, hiddenValue(t, body, "state"))
	m := regexp.MustCompile(`(?s)id="username".*?value="([^"]*)"`).FindStringSubmatch(body)
	require.NotNil(t, m)
	assert.Equal(t, `"><img src=x onerror=alert(1)>`, html.UnescapeString(m[1]))
}

func TestAuthorizePage_SecurityHeaders(t *testing.T) {
	t.Parallel()
	_, challenge := newPKCE(t)
	f := newOAuthFixture(t, &fakeAuthenticator{}, config.ServerConfig{})

	nonceRe := regexp.MustCompile(`script-src 'nonce-([A-Za-z0-9_-]+)'`)
	var nonces []string
	for i := 0; i < 2; i++ {
		rec := f.do(getAuthorize(authorizeQuery(challenge), ""))
		require.Equal(t, http.StatusOK, rec.Code)
		h := rec.Header()
		csp := h.Get("Content-Security-Policy")
		for _, directive := range []string{"default-src 'none'", "frame-ancestors 'none'", "base-uri 'none'", "img-src data:", "form-action 'self' https://claude.ai"} {
			assert.Contains(t, csp, directive)
		}
		assert.NotContains(t, csp, "unsafe-inline")
		assert.Equal(t, "DENY", h.Get("X-Frame-Options"))
		assert.Equal(t, "no-referrer", h.Get("Referrer-Policy"))
		assert.Equal(t, "no-store", h.Get("Cache-Control"))
		assert.Equal(t, "nosniff", h.Get("X-Content-Type-Options"))
		assert.Equal(t, "text/html; charset=utf-8", h.Get("Content-Type"))

		m := nonceRe.FindStringSubmatch(csp)
		require.NotNil(t, m)
		body := rec.Body.String()
		assert.Contains(t, body, `<style nonce="`+m[1]+`">`)
		assert.Contains(t, body, `<script nonce="`+m[1]+`">`)
		assert.NotContains(t, body, ` style="`, "inline style attributes would be blocked by the CSP")
		nonces = append(nonces, m[1])
	}
	assert.NotEqual(t, nonces[0], nonces[1], "nonce must be per response")
}

// ---------------------------------------------------------------------------
// Request validation
// ---------------------------------------------------------------------------

func TestAuthorizeGet_Validation(t *testing.T) {
	t.Parallel()
	_, challenge := newPKCE(t)

	tests := []struct {
		name         string
		mutate       func(url.Values)
		wantStatus   int
		wantRedirect string // expected "error" param on the redirect; "" = no redirect
		wantContains string
	}{
		{name: "missing client_id", mutate: func(v url.Values) { v.Del("client_id") }, wantStatus: http.StatusBadRequest, wantContains: "no es válida"},
		{name: "unknown client", mutate: func(v url.Values) { v.Set("client_id", "nope") }, wantStatus: http.StatusBadRequest, wantContains: "no está registrada"},
		{
			name:       "unregistered redirect_uri never receives a redirect",
			mutate:     func(v url.Values) { v.Set("redirect_uri", "https://evil.example/cb"); v.Set("response_type", "token") },
			wantStatus: http.StatusBadRequest, wantContains: "dirección de retorno",
		},
		{name: "unsupported response_type", mutate: func(v url.Values) { v.Set("response_type", "token") }, wantStatus: http.StatusSeeOther, wantRedirect: oauth2.ErrorUnsupportedResponseType},
		{name: "missing PKCE challenge", mutate: func(v url.Values) { v.Del("code_challenge") }, wantStatus: http.StatusSeeOther, wantRedirect: oauth2.ErrorInvalidRequest},
		{name: "plain PKCE rejected", mutate: func(v url.Values) { v.Set("code_challenge_method", "plain") }, wantStatus: http.StatusSeeOther, wantRedirect: oauth2.ErrorInvalidRequest},
		{name: "redirect_uri defaults to the only registered one", mutate: func(v url.Values) { v.Del("redirect_uri") }, wantStatus: http.StatusOK, wantContains: testRedirectURI},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			f := newOAuthFixture(t, &fakeAuthenticator{}, config.ServerConfig{})
			q := authorizeQuery(challenge)
			tc.mutate(q)
			rec := f.do(getAuthorize(q, ""))

			assert.Equal(t, tc.wantStatus, rec.Code)
			if tc.wantContains != "" {
				assert.Contains(t, html.UnescapeString(rec.Body.String()), tc.wantContains)
			}
			if tc.wantRedirect == "" {
				assert.Empty(t, rec.Header().Get("Location"))
				return
			}
			loc, err := url.Parse(rec.Header().Get("Location"))
			require.NoError(t, err)
			assert.Equal(t, "claude.ai", loc.Host)
			assert.Equal(t, tc.wantRedirect, loc.Query().Get("error"))
			assert.Equal(t, "state-123", loc.Query().Get("state"))
		})
	}
}

func TestAuthorizePost_Deny(t *testing.T) {
	t.Parallel()
	_, challenge := newPKCE(t)

	tests := []struct {
		name       string
		mutate     func(url.Values)
		wantStatus int
		wantDenied bool
	}{
		{name: "redirects access_denied with state", mutate: func(url.Values) {}, wantStatus: http.StatusSeeOther, wantDenied: true},
		{name: "works without credentials (formnovalidate)", mutate: func(v url.Values) { v.Del("username"); v.Del("password") }, wantStatus: http.StatusSeeOther, wantDenied: true},
		{name: "unregistered redirect_uri is not followed", mutate: func(v url.Values) { v.Set("redirect_uri", "https://evil.example/cb") }, wantStatus: http.StatusBadRequest},
		{name: "same host, other path is not followed", mutate: func(v url.Values) { v.Set("redirect_uri", "https://claude.ai/other") }, wantStatus: http.StatusBadRequest},
		{name: "unknown client is not followed", mutate: func(v url.Values) { v.Set("client_id", "nope") }, wantStatus: http.StatusBadRequest},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			fa := &fakeAuthenticator{}
			f := newOAuthFixture(t, fa, config.ServerConfig{})
			form := loginForm(challenge, testEmail, testPassword, "deny")
			tc.mutate(form)
			rec := f.do(postForm("/oauth/authorize", form, ""))

			assert.Equal(t, tc.wantStatus, rec.Code)
			assert.Empty(t, fa.Calls(), "deny must not try to log in")
			if !tc.wantDenied {
				assert.Empty(t, rec.Header().Get("Location"))
				return
			}
			loc, err := url.Parse(rec.Header().Get("Location"))
			require.NoError(t, err)
			assert.Equal(t, "https://claude.ai/api/mcp/auth_callback", loc.Scheme+"://"+loc.Host+loc.Path)
			assert.Equal(t, oauth2.ErrorAccessDenied, loc.Query().Get("error"))
			assert.Equal(t, "state-123", loc.Query().Get("state"))
			assert.Empty(t, loc.Query().Get("code"))
			assert.Equal(t, "no-referrer", rec.Header().Get("Referrer-Policy"))
		})
	}
}

// ---------------------------------------------------------------------------
// End-to-end flow with PKCE
// ---------------------------------------------------------------------------

type tokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	TokenType    string `json:"token_type"`
	Error        string `json:"error"`
}

func exchangeCode(t *testing.T, f *oauthFixture, code, verifier string) (*httptest.ResponseRecorder, tokenResponse) {
	t.Helper()
	rec := f.do(postForm("/oauth/token", url.Values{
		"grant_type":    {"authorization_code"},
		"code":          {code},
		"redirect_uri":  {testRedirectURI},
		"client_id":     {testClientID},
		"code_verifier": {verifier},
	}, ""))
	var tr tokenResponse
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &tr), rec.Body.String())
	return rec, tr
}

func authorizeCode(t *testing.T, f *oauthFixture, challenge string) string {
	t.Helper()
	// GET renders the page; the POST sends back exactly its hidden fields.
	page := f.do(getAuthorize(authorizeQuery(challenge), ""))
	require.Equal(t, http.StatusOK, page.Code)
	body := page.Body.String()
	form := url.Values{}
	for _, name := range []string{"client_id", "redirect_uri", "state", "scope", "code_challenge", "code_challenge_method"} {
		form.Set(name, hiddenValue(t, body, name))
	}
	form.Set("username", testEmail)
	form.Set("password", testPassword)
	form.Set("action", "approve")

	rec := f.do(postForm("/oauth/authorize", form, ""))
	require.Equal(t, http.StatusSeeOther, rec.Code, rec.Body.String())
	loc, err := url.Parse(rec.Header().Get("Location"))
	require.NoError(t, err)
	require.Equal(t, "claude.ai", loc.Host)
	require.Equal(t, "state-123", loc.Query().Get("state"))
	code := loc.Query().Get("code")
	require.NotEmpty(t, code)
	return code
}

func TestAuthorizeFlow_EndToEndWithPKCE(t *testing.T) {
	t.Parallel()
	f := newOAuthFixture(t, &fakeAuthenticator{}, config.ServerConfig{})

	t.Run("code, token, verifier, refresh rotation", func(t *testing.T) {
		verifier, challenge := newPKCE(t)
		code := authorizeCode(t, f, challenge)

		rec, tokens := exchangeCode(t, f, code, verifier)
		require.Equal(t, http.StatusOK, rec.Code, rec.Body.String())
		require.NotEmpty(t, tokens.AccessToken)
		require.NotEmpty(t, tokens.RefreshToken)

		info, err := f.provider.TokenVerifier()(tokens.AccessToken)
		require.NoError(t, err)
		assert.Equal(t, testEmail, info.Subject, "MCPAuthMiddleware resolves the subject (email) to the user id")
		assert.Equal(t, testClientID, info.ClientID)
		assert.Equal(t, "mcp", info.Scope)

		// Codes are single-use.
		rec, replay := exchangeCode(t, f, code, verifier)
		assert.Equal(t, http.StatusBadRequest, rec.Code)
		assert.Equal(t, oauth2.ErrorInvalidGrant, replay.Error)

		// Refresh issues a new pair; the old access token is revoked.
		refresh := f.do(postForm("/oauth/token", url.Values{
			"grant_type": {"refresh_token"}, "refresh_token": {tokens.RefreshToken}, "client_id": {testClientID},
		}, ""))
		require.Equal(t, http.StatusOK, refresh.Code, refresh.Body.String())
		var refreshed tokenResponse
		require.NoError(t, json.Unmarshal(refresh.Body.Bytes(), &refreshed))
		assert.NotEqual(t, tokens.AccessToken, refreshed.AccessToken)
		_, err = f.provider.TokenVerifier()(tokens.AccessToken)
		assert.Error(t, err)
		_, err = f.provider.TokenVerifier()(refreshed.AccessToken)
		assert.NoError(t, err)
	})

	t.Run("wrong verifier is rejected", func(t *testing.T) {
		_, challenge := newPKCE(t)
		otherVerifier, _ := newPKCE(t)
		code := authorizeCode(t, f, challenge)
		rec, tr := exchangeCode(t, f, code, otherVerifier)
		assert.Equal(t, http.StatusBadRequest, rec.Code)
		assert.Equal(t, oauth2.ErrorInvalidGrant, tr.Error)
	})

	t.Run("failed login issues no code", func(t *testing.T) {
		_, challenge := newPKCE(t)
		rec := f.do(postForm("/oauth/authorize", loginForm(challenge, testEmail, "wrong", "approve"), ""))
		assert.Equal(t, http.StatusOK, rec.Code)
		assert.Empty(t, rec.Header().Get("Location"))
	})

	t.Run("POST without PKCE is refused", func(t *testing.T) {
		form := loginForm("", testEmail, testPassword, "approve")
		rec := f.do(postForm("/oauth/authorize", form, ""))
		require.Equal(t, http.StatusSeeOther, rec.Code)
		loc, err := url.Parse(rec.Header().Get("Location"))
		require.NoError(t, err)
		assert.Equal(t, oauth2.ErrorInvalidRequest, loc.Query().Get("error"))
		assert.Empty(t, loc.Query().Get("code"))
	})
}

// ---------------------------------------------------------------------------
// Client IP → login lockout
// ---------------------------------------------------------------------------

func TestAuthorizePost_PassesTrustedClientIP(t *testing.T) {
	t.Parallel()
	_, challenge := newPKCE(t)

	tests := []struct {
		name    string
		ipCfg   config.ServerConfig
		headers map[string]string
		wantIP  string
	}{
		{
			name:    "platform header (Railway X-Real-IP) wins, X-Forwarded-For ignored",
			ipCfg:   config.ServerConfig{TrustedPlatformHeader: "X-Real-IP"},
			headers: map[string]string{"X-Real-IP": "203.0.113.7", "X-Forwarded-For": "1.2.3.4"},
			wantIP:  "203.0.113.7",
		},
		{
			name:    "no trusted proxy: spoofed X-Forwarded-For is ignored",
			headers: map[string]string{"X-Forwarded-For": "1.2.3.4", "X-Real-IP": "5.6.7.8"},
			wantIP:  "192.0.2.10",
		},
		{
			name:    "signed X-Client-IP from the frontend server",
			ipCfg:   config.ServerConfig{ProxySharedSecret: "s3cret", TrustedPlatformHeader: "X-Real-IP"},
			headers: map[string]string{"X-Proxy-Secret": "s3cret", "X-Client-IP": "198.51.100.4", "X-Real-IP": "203.0.113.7"},
			wantIP:  "198.51.100.4",
		},
		{
			name:    "X-Client-IP with a wrong secret is ignored",
			ipCfg:   config.ServerConfig{ProxySharedSecret: "s3cret", TrustedPlatformHeader: "X-Real-IP"},
			headers: map[string]string{"X-Proxy-Secret": "guess", "X-Client-IP": "198.51.100.4", "X-Real-IP": "203.0.113.7"},
			wantIP:  "203.0.113.7",
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			fa := &fakeAuthenticator{}
			f := newOAuthFixture(t, fa, tc.ipCfg)
			req := postForm("/oauth/authorize", loginForm(challenge, testEmail, "wrong", "approve"), "")
			req.RemoteAddr = "192.0.2.10:51234"
			for k, v := range tc.headers {
				req.Header.Set(k, v)
			}
			rec := f.do(req)
			require.Equal(t, http.StatusOK, rec.Code)
			calls := fa.Calls()
			require.Len(t, calls, 1)
			assert.Equal(t, tc.wantIP, calls[0].ip)
			assert.Equal(t, testEmail, calls[0].email)
		})
	}
}

// fakeUsers is the user repository AuthService needs for a password login.
type fakeUsers struct{ byEmail map[string]*user.User }

func (f *fakeUsers) FindUserById(context.Context, string) (*user.User, error) {
	return nil, errorhttp.ErrNotFound
}
func (f *fakeUsers) FindUserByEmail(_ context.Context, email string) (*user.User, error) {
	if u, ok := f.byEmail[email]; ok {
		return u, nil
	}
	return nil, errorhttp.ErrNotFound
}
func (f *fakeUsers) FindUserByIp(context.Context, string) (*user.User, error) {
	return nil, errorhttp.ErrNotFound
}
func (f *fakeUsers) DeleteDemoUsersOlderThan(context.Context, time.Time) error { return nil }
func (f *fakeUsers) Save(context.Context, *user.User) error                    { return nil }
func (f *fakeUsers) Delete(context.Context, string) error                      { return nil }
func (f *fakeUsers) FindAll(context.Context) ([]*user.User, error)             { return nil, nil }
func (f *fakeUsers) FindAllFiltered(context.Context, string, int, int) ([]*user.User, error) {
	return nil, nil
}
func (f *fakeUsers) Update(context.Context, *user.User) error { return nil }
func (f *fakeUsers) SoftDelete(context.Context, string) error { return nil }

// The real AuthService lockout is keyed by email + the IP the authorize
// endpoint passes: an attacker locking themselves out from one IP does not
// lock the user out from another.
func TestAuthorizePost_LockoutIsPerClientIP(t *testing.T) {
	t.Parallel()
	hash, err := bcrypt.GenerateFromPassword([]byte(testPassword), bcrypt.MinCost)
	require.NoError(t, err)
	users := &fakeUsers{byEmail: map[string]*user.User{testEmail: {Id: "alice-id", Email: testEmail, Password: string(hash)}}}
	svc := auth.NewAuthService(users, nil, nil, nil, nil, &config.Config{
		JWT: config.JWTConfig{
			Secret: "oauth-test-secret-at-least-32-characters", Expiration: time.Minute,
			Issuer: "gestor-test", Audience: "gestor-test-api",
		},
		Security: config.SecurityConfig{MaxLoginAttempts: 2, AccountLockTime: 15 * time.Minute},
	})
	f := newOAuthFixture(t, AuthServiceAuthenticator{Service: svc}, config.ServerConfig{TrustedPlatformHeader: "X-Real-IP"})
	_, challenge := newPKCE(t)

	attempt := func(ip, password string) *httptest.ResponseRecorder {
		req := postForm("/oauth/authorize", loginForm(challenge, testEmail, password, "approve"), "")
		req.Header.Set("X-Real-IP", ip)
		return f.do(req)
	}

	for i := 0; i < 2; i++ {
		rec := attempt("203.0.113.66", "guess")
		require.Equal(t, http.StatusOK, rec.Code)
		require.Contains(t, rec.Body.String(), "no son correctos")
	}
	locked := attempt("203.0.113.66", testPassword)
	assert.Equal(t, http.StatusTooManyRequests, locked.Code, "the attacker's IP is locked even with the right password")
	assert.Contains(t, locked.Body.String(), "Demasiados intentos")

	ok := attempt("198.51.100.20", testPassword)
	assert.Equal(t, http.StatusSeeOther, ok.Code, "the user can still sign in from their own IP")
	assert.Contains(t, ok.Header().Get("Location"), "code=")
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

func TestFormActionSource(t *testing.T) {
	t.Parallel()
	tests := map[string]string{
		"https://claude.ai/api/mcp/auth_callback": "https://claude.ai",
		"http://localhost:6274/oauth/callback":    "http://localhost:6274",
		"cursor://anysphere.cursor-mcp/cb":        "cursor:",
		"/relative/path":                          "",
		"https://a.example;script-src *":          "",
		"":                                        "",
	}
	for in, want := range tests {
		assert.Equal(t, want, formActionSource(in), in)
	}
}
