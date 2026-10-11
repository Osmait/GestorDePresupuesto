package mcp

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/plexusone/mcpkit/oauth2"

	authDomain "github.com/osmait/gestorDePresupuesto/internal/domain/auth"
	"github.com/osmait/gestorDePresupuesto/internal/services/auth"
)

// DefaultAppURL is the SBFinance web app linked from the OAuth login page.
const DefaultAppURL = "https://presupuesto.saulburgos.com"

// maxTokenRequestBody bounds the token endpoint form (mcpkit uses 1 MB).
const maxTokenRequestBody = 64 << 10

// Authenticator validates the credentials typed on the OAuth login page.
//
// clientIP is the trusted client IP resolved by the API middleware (gin's
// ClientIP after ConfigureClientIP), used for the failed-login lockout.
// It returns nil on success, an error matching auth.ErrInvalidCredentials for
// bad credentials, a *auth.LoginLockedError while locked out, and any other
// error for infrastructure failures.
type Authenticator interface {
	Authenticate(ctx context.Context, email, password, clientIP string) error
}

// AuthServiceAuthenticator adapts the application's AuthService (same
// credential check, timing protection and per email+IP lockout as the web
// login) to Authenticator.
type AuthServiceAuthenticator struct {
	Service *auth.AuthService
}

// Authenticate implements Authenticator.
func (a AuthServiceAuthenticator) Authenticate(ctx context.Context, email, password, clientIP string) error {
	_, err := a.Service.LoginFromIP(ctx, &authDomain.AuthRequest{Email: email, Password: password}, clientIP)
	return err
}

// clientSecretHasher is implemented by storages that keep client secrets
// hashed (mcpoauth.Storage): GetClient then returns the hash, so the token
// endpoint must hash the presented secret before mcpkit compares them.
type clientSecretHasher interface {
	HashClientSecret(secret string) string
}

// OAuthConfig configures the MCP OAuth 2.1 provider.
type OAuthConfig struct {
	// Issuer is the public base URL of the API (MCP_BASE_URL).
	Issuer string
	// Authenticator checks the login page credentials. Required.
	Authenticator Authenticator
	// Storage persists clients, codes and tokens. nil means in-memory
	// storage, which loses every connection on restart: tests only.
	Storage oauth2.Storage
	// AppURL is the web app linked from the login page (DefaultAppURL if empty).
	AppURL string
	// AuthorizationCodeExpiry defaults to 10 minutes.
	AuthorizationCodeExpiry time.Duration
}

// OAuthProvider is the MCP OAuth 2.1 authorization server.
//
// The token, registration and metadata endpoints are mcpkit's. The
// authorization endpoint (login page) is our own: mcpkit's Authenticator has
// no access to the request, so it could not pass the client IP to the login
// lockout, localize the page, set a CSP nonce or offer a "deny" button.
type OAuthProvider struct {
	server    *oauth2.Server
	storage   oauth2.Storage
	authorize *authorizeHandler
}

// NewOAuthProvider builds the provider.
func NewOAuthProvider(cfg OAuthConfig) (*OAuthProvider, error) {
	if cfg.Authenticator == nil {
		return nil, errors.New("oauth: authenticator is required")
	}
	storage := cfg.Storage
	if storage == nil {
		storage = oauth2.NewMemoryStorage()
	}
	codeExpiry := cfg.AuthorizationCodeExpiry
	if codeExpiry <= 0 {
		codeExpiry = 10 * time.Minute
	}
	appURL := cfg.AppURL
	if appURL == "" {
		appURL = DefaultAppURL
	}

	srv, err := oauth2.New(&oauth2.Config{
		Issuer:                  cfg.Issuer,
		Storage:                 storage,
		AuthorizationCodeExpiry: codeExpiry,
		// mcpkit's own authorization handler is never mounted (see
		// OAuthProvider); if it ever were, it must not log anybody in.
		Authenticator: func(string, string) bool { return false },
	})
	if err != nil {
		return nil, fmt.Errorf("oauth: %w", err)
	}

	return &OAuthProvider{
		server:  srv,
		storage: storage,
		authorize: &authorizeHandler{
			storage:    storage,
			auth:       cfg.Authenticator,
			codeExpiry: codeExpiry,
			appURL:     appURL,
			now:        time.Now,
		},
	}, nil
}

// Server returns the underlying mcpkit server.
func (p *OAuthProvider) Server() *oauth2.Server { return p.server }

// AuthorizeHandler serves GET/POST /oauth/authorize. The client IP passed to
// the login lockout is gin's ClientIP(), i.e. the same trusted resolution
// (PROXY_SHARED_SECRET / TRUSTED_PLATFORM_HEADER / TRUSTED_PROXIES) as the
// rest of the API; X-Forwarded-For from untrusted peers is never used.
func (p *OAuthProvider) AuthorizeHandler() gin.HandlerFunc {
	return func(c *gin.Context) {
		p.authorize.serve(c.Writer, c.Request, c.ClientIP())
	}
}

// ServeAuthorize serves the authorization endpoint with an already resolved
// client IP (for callers outside gin).
func (p *OAuthProvider) ServeAuthorize(w http.ResponseWriter, r *http.Request, clientIP string) {
	p.authorize.serve(w, r, clientIP)
}

// TokenHandler serves POST /oauth/token (mcpkit). When the storage keeps
// client secrets hashed, the presented secret is hashed first so mcpkit
// compares hash with hash.
func (p *OAuthProvider) TokenHandler() http.Handler {
	next := p.server.TokenHandler()
	hasher, ok := p.storage.(clientSecretHasher)
	if !ok {
		return next
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			r.Body = http.MaxBytesReader(w, r.Body, maxTokenRequestBody)
			if err := r.ParseForm(); err != nil {
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusBadRequest)
				_, _ = w.Write([]byte(`{"error":"invalid_request","error_description":"Failed to parse form"}`))
				return
			}
			hashPresentedClientSecret(r, hasher)
		}
		next.ServeHTTP(w, r)
	})
}

// hashPresentedClientSecret replaces the client secret of a parsed token
// request (HTTP Basic or form) with its hash. mcpkit calls ParseForm again,
// which is a no-op once r.Form/r.PostForm are set.
func hashPresentedClientSecret(r *http.Request, hasher clientSecretHasher) {
	if id, secret, ok := r.BasicAuth(); ok && secret != "" {
		r.SetBasicAuth(id, hasher.HashClientSecret(secret))
	}
	if secret := r.Form.Get("client_secret"); secret != "" {
		hashed := hasher.HashClientSecret(secret)
		r.Form.Set("client_secret", hashed)
		if r.PostForm != nil && r.PostForm.Has("client_secret") {
			r.PostForm.Set("client_secret", hashed)
		}
	}
}

// RegistrationHandler serves dynamic client registration (mcpkit).
func (p *OAuthProvider) RegistrationHandler() http.Handler { return p.server.RegistrationHandler() }

// MetadataHandler serves the authorization server metadata (mcpkit).
func (p *OAuthProvider) MetadataHandler() http.Handler { return p.server.MetadataHandler() }

// ProtectedResourceMetadataHandler serves the protected resource metadata.
func (p *OAuthProvider) ProtectedResourceMetadataHandler(resourcePath string) http.Handler {
	return p.server.ProtectedResourceMetadataHandler(resourcePath)
}

// TokenVerifier resolves an access token for MCPAuthMiddleware.
func (p *OAuthProvider) TokenVerifier() func(token string) (*oauth2.TokenInfo, error) {
	return p.server.TokenVerifier()
}
