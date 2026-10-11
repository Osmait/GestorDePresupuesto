package mcp

import (
	"crypto/rand"
	"encoding/base64"
	"errors"
	"math"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/plexusone/mcpkit/oauth2"
	"github.com/rs/zerolog/log"

	"github.com/osmait/gestorDePresupuesto/internal/platform/i18n"
	"github.com/osmait/gestorDePresupuesto/internal/services/auth"
)

const (
	// maxAuthorizeForm bounds the login form body.
	maxAuthorizeForm = 64 << 10
	// PKCE S256 challenges are 43 characters; RFC 7636 allows up to 128.
	minCodeChallengeLen = 43
	maxCodeChallengeLen = 128

	actionDeny = "deny"
)

// authorizeHandler implements the OAuth 2.1 authorization endpoint (login +
// consent) on top of the shared oauth2.Storage, so the codes it issues are
// redeemed by mcpkit's token endpoint. Validation mirrors mcpkit v0.4.0
// (handleAuthorizationGet/Post) with two fixes: the redirect_uri is always
// validated against the registered client before any redirect, and PKCE is
// re-checked on POST.
type authorizeHandler struct {
	storage    oauth2.Storage
	auth       Authenticator
	codeExpiry time.Duration
	appURL     string
	now        func() time.Time
}

// authorizeRequest holds the OAuth parameters carried from the GET query to
// the form's hidden fields.
type authorizeRequest struct {
	ClientID            string
	RedirectURI         string
	State               string
	Scope               string
	CodeChallenge       string
	CodeChallengeMethod string
}

func readAuthorizeRequest(v url.Values) authorizeRequest {
	return authorizeRequest{
		ClientID:            v.Get("client_id"),
		RedirectURI:         v.Get("redirect_uri"),
		State:               v.Get("state"),
		Scope:               v.Get("scope"),
		CodeChallenge:       v.Get("code_challenge"),
		CodeChallengeMethod: v.Get("code_challenge_method"),
	}
}

func (h *authorizeHandler) serve(w http.ResponseWriter, r *http.Request, clientIP string) {
	locale := i18n.ParseAcceptLanguage(r.Header.Get("Accept-Language"))
	switch r.Method {
	case http.MethodGet, http.MethodHead:
		h.handleGet(w, r, locale)
	case http.MethodPost:
		h.handlePost(w, r, locale, clientIP)
	default:
		w.Header().Set("Allow", "GET, POST")
		h.renderError(w, locale, http.StatusMethodNotAllowed, pageErrInvalidRequest)
	}
}

// validateClient loads the client and checks the redirect URI exactly as
// mcpkit does. On failure it renders the error page (never redirects: an
// unvalidated redirect_uri must not receive anything).
func (h *authorizeHandler) validateClient(w http.ResponseWriter, locale i18n.Locale, req *authorizeRequest, defaultRedirect bool) (*oauth2.Client, bool) {
	if req.ClientID == "" {
		h.renderError(w, locale, http.StatusBadRequest, pageErrInvalidRequest)
		return nil, false
	}
	client, err := h.storage.GetClient(req.ClientID)
	if err != nil {
		if !errors.Is(err, oauth2.ErrClientNotFound) {
			log.Error().Err(err).Msg("oauth authorize: client lookup failed")
			h.renderError(w, locale, http.StatusInternalServerError, pageErrServer)
			return nil, false
		}
		h.renderError(w, locale, http.StatusBadRequest, pageErrUnknownClient)
		return nil, false
	}
	if defaultRedirect && req.RedirectURI == "" && len(client.RedirectURIs) == 1 {
		req.RedirectURI = client.RedirectURIs[0]
	}
	if !isValidRedirectURI(req.RedirectURI, client.RedirectURIs) {
		h.renderError(w, locale, http.StatusBadRequest, pageErrInvalidRedirect)
		return nil, false
	}
	return client, true
}

// pkceError returns the OAuth error description for an invalid PKCE
// challenge, or "" when it is acceptable.
func pkceError(req authorizeRequest) string {
	if req.CodeChallenge == "" {
		return "code_challenge is required (PKCE)"
	}
	if req.CodeChallengeMethod != "" && req.CodeChallengeMethod != oauth2.PKCEMethodS256 {
		return "Only S256 code_challenge_method is supported"
	}
	if n := len(req.CodeChallenge); n < minCodeChallengeLen || n > maxCodeChallengeLen {
		return "Invalid code_challenge"
	}
	return ""
}

func (h *authorizeHandler) handleGet(w http.ResponseWriter, r *http.Request, locale i18n.Locale) {
	q := r.URL.Query()
	req := readAuthorizeRequest(q)
	client, ok := h.validateClient(w, locale, &req, true)
	if !ok {
		return
	}
	if q.Get("response_type") != "code" {
		redirectWithError(w, r, req, oauth2.ErrorUnsupportedResponseType, "Only 'code' response_type is supported")
		return
	}
	if msg := pkceError(req); msg != "" {
		redirectWithError(w, r, req, oauth2.ErrorInvalidRequest, msg)
		return
	}
	h.renderLogin(w, locale, http.StatusOK, client, req, "", pageErrNone, 0)
}

func (h *authorizeHandler) handlePost(w http.ResponseWriter, r *http.Request, locale i18n.Locale, clientIP string) {
	r.Body = http.MaxBytesReader(w, r.Body, maxAuthorizeForm)
	if err := r.ParseForm(); err != nil {
		h.renderError(w, locale, http.StatusBadRequest, pageErrInvalidRequest)
		return
	}
	// Same lookup as mcpkit (r.Form: body first, then the query string the
	// form was posted to).
	req := readAuthorizeRequest(r.Form)
	client, ok := h.validateClient(w, locale, &req, false)
	if !ok {
		return
	}

	// From here on the redirect URI is a registered one of this client.
	if r.Form.Get("action") == actionDeny {
		redirectWithError(w, r, req, oauth2.ErrorAccessDenied, "The user denied the authorization request")
		return
	}
	if msg := pkceError(req); msg != "" {
		redirectWithError(w, r, req, oauth2.ErrorInvalidRequest, msg)
		return
	}

	email := r.Form.Get("username")
	password := r.Form.Get("password")
	if strings.TrimSpace(email) == "" || password == "" {
		h.renderLogin(w, locale, http.StatusOK, client, req, email, pageErrMissingCredentials, 0)
		return
	}

	if err := h.auth.Authenticate(r.Context(), email, password, clientIP); err != nil {
		var locked *auth.LoginLockedError
		switch {
		case errors.As(err, &locked):
			w.Header().Set("Retry-After", strconv.Itoa(int(math.Ceil(locked.RetryAfter.Seconds()))))
			h.renderLogin(w, locale, http.StatusTooManyRequests, client, req, email, pageErrLocked, locked.RetryAfter)
		case errors.Is(err, auth.ErrInvalidCredentials):
			h.renderLogin(w, locale, http.StatusOK, client, req, email, pageErrInvalidCredentials, 0)
		default:
			log.Error().Err(err).Str("client_id", req.ClientID).Msg("oauth authorize: login failed")
			h.renderLogin(w, locale, http.StatusInternalServerError, client, req, email, pageErrServer, 0)
		}
		return
	}

	code, err := oauth2.GenerateAuthorizationCode()
	if err != nil {
		redirectWithError(w, r, req, oauth2.ErrorServerError, "Failed to generate authorization code")
		return
	}
	now := h.now()
	if err := h.storage.CreateAuthorizationCode(&oauth2.AuthorizationCode{
		Code:                code,
		ClientID:            req.ClientID,
		RedirectURI:         req.RedirectURI,
		Scope:               req.Scope,
		CodeChallenge:       req.CodeChallenge,
		CodeChallengeMethod: req.CodeChallengeMethod,
		Subject:             email,
		ExpiresAt:           now.Add(h.codeExpiry),
		CreatedAt:           now,
	}); err != nil {
		log.Error().Err(err).Str("client_id", req.ClientID).Msg("oauth authorize: storing code failed")
		redirectWithError(w, r, req, oauth2.ErrorServerError, "Failed to store authorization code")
		return
	}

	log.Info().Str("client_id", req.ClientID).Msg("oauth authorize: authorization code issued")
	redirectWithParams(w, r, req.RedirectURI, url.Values{"code": {code}}, req.State)
}

// redirectWithError sends an OAuth error to the (already validated) redirect URI.
func redirectWithError(w http.ResponseWriter, r *http.Request, req authorizeRequest, code, description string) {
	redirectWithParams(w, r, req.RedirectURI, url.Values{
		"error":             {code},
		"error_description": {description},
	}, req.State)
}

func redirectWithParams(w http.ResponseWriter, r *http.Request, redirectURI string, params url.Values, state string) {
	u, err := url.Parse(redirectURI)
	if err != nil {
		http.Error(w, "invalid redirect_uri", http.StatusBadRequest)
		return
	}
	q := u.Query()
	for k, v := range params {
		q[k] = v
	}
	if state != "" {
		q.Set("state", state)
	}
	u.RawQuery = q.Encode()
	h := w.Header()
	h.Set("Cache-Control", "no-store")
	h.Set("Pragma", "no-cache")
	h.Set("Referrer-Policy", "no-referrer")
	// 303: the browser follows a POST with a GET to the client callback.
	http.Redirect(w, r, u.String(), http.StatusSeeOther)
}

// isValidRedirectURI is mcpkit v0.4.0's check (unexported there): the
// requested URI must match a registered absolute URI by scheme, host
// (case-insensitive) and path, or a registered relative URI by path.
// Wildcards are never accepted.
func isValidRedirectURI(uri string, allowed []string) bool {
	if uri == "" {
		return false
	}
	requested, err := url.Parse(uri)
	if err != nil {
		return false
	}
	for _, a := range allowed {
		if a == "" || a == "*" {
			continue
		}
		allowedURL, err := url.Parse(a)
		if err != nil {
			continue
		}
		if allowedURL.Scheme != "" {
			if requested.Scheme == allowedURL.Scheme &&
				strings.EqualFold(requested.Host, allowedURL.Host) &&
				requested.Path == allowedURL.Path {
				return true
			}
		} else if requested.Path == allowedURL.Path && requested.Host == "" && requested.Scheme == "" {
			return true
		}
	}
	return false
}

// newNonce returns a random CSP nonce.
func newNonce() (string, error) {
	b := make([]byte, 18)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

// formActionSource is the CSP form-action source for the redirect target:
// browsers apply form-action to the redirect that follows the form POST.
func formActionSource(redirectURI string) string {
	u, err := url.Parse(redirectURI)
	if err != nil || u.Scheme == "" {
		return ""
	}
	if u.Scheme == "http" || u.Scheme == "https" {
		if u.Host == "" || strings.ContainsAny(u.Host, " ;,'\"") {
			return ""
		}
		return u.Scheme + "://" + u.Host
	}
	// Native-app callbacks (e.g. cursor://...): allow the scheme.
	for _, c := range u.Scheme {
		if (c < 'a' || c > 'z') && (c < 'A' || c > 'Z') && (c < '0' || c > '9') && c != '+' && c != '-' && c != '.' {
			return ""
		}
	}
	return u.Scheme + ":"
}

// setPageHeaders sets the security headers of every HTML page served by the
// authorization endpoint.
func setPageHeaders(w http.ResponseWriter, locale i18n.Locale, nonce, formAction string) {
	if formAction == "" {
		formAction = "'none'"
	}
	h := w.Header()
	h.Set("Content-Type", "text/html; charset=utf-8")
	h.Set("Content-Language", string(locale))
	h.Set("Vary", "Accept-Language")
	h.Set("Cache-Control", "no-store")
	h.Set("Pragma", "no-cache")
	h.Set("X-Content-Type-Options", "nosniff")
	h.Set("X-Frame-Options", "DENY")
	h.Set("Referrer-Policy", "no-referrer")
	h.Set("Content-Security-Policy", "default-src 'none'; "+
		"style-src 'nonce-"+nonce+"'; "+
		"script-src 'nonce-"+nonce+"'; "+
		"img-src data:; "+
		"form-action "+formAction+"; "+
		"frame-ancestors 'none'; base-uri 'none'")
}
