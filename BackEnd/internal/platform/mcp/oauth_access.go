package mcp

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"slices"
	"strings"
)

// Access levels the user can pick on the consent page.
const (
	accessFull = "full"
	accessRead = "read"
)

// maxRegistrationBody bounds a dynamic client registration request read by
// the redirect allowlist check (omniskill uses 1 MB; registrations are tiny).
const maxRegistrationBody = 64 << 10

// defaultTrustedRedirectHosts are the redirect hosts of the clients the
// connector is meant for: Claude (claude.ai, claude.com). Loopback hosts are
// always trusted too (local MCP clients). MCP_TRUSTED_REDIRECT_HOSTS adds more.
var defaultTrustedRedirectHosts = []string{"claude.ai", "claude.com"}

// loopbackHosts may use plain http (RFC 8252 §7.3).
var loopbackHosts = []string{"localhost", "127.0.0.1", "::1"}

// redirectAllowlist tells whether a client's redirect URI goes to a known host.
type redirectAllowlist struct {
	hosts []string
}

// newRedirectAllowlist returns the default hosts plus extra (host names, or
// URLs whose host is used), lowercased.
func newRedirectAllowlist(extra []string) *redirectAllowlist {
	hosts := slices.Clone(defaultTrustedRedirectHosts)
	for _, h := range extra {
		h = strings.ToLower(strings.TrimSpace(h))
		if strings.Contains(h, "://") {
			if u, err := url.Parse(h); err == nil {
				h = u.Hostname()
			}
		}
		h = strings.Trim(h, "[]")
		if h != "" && !slices.Contains(hosts, h) {
			hosts = append(hosts, h)
		}
	}
	return &redirectAllowlist{hosts: hosts}
}

// trusted reports whether redirectURI is https on an allowlisted host, or
// http(s) on a loopback host. Native-app schemes (cursor://...) and every
// other host are not trusted.
func (a *redirectAllowlist) trusted(redirectURI string) bool {
	u, err := url.Parse(redirectURI)
	if err != nil || u.User != nil {
		return false
	}
	host := strings.ToLower(u.Hostname())
	if host == "" {
		return false
	}
	if slices.Contains(loopbackHosts, host) {
		return u.Scheme == "http" || u.Scheme == "https"
	}
	return u.Scheme == "https" && slices.Contains(a.hosts, host)
}

// grantedScope is the scope the code is issued with: the requested scope, or
// a read-only version of it when the user picked read-only access on the
// consent page. It never widens the request.
func grantedScope(requested, access string) string {
	if access != accessRead || isReadOnlyScope(requested) {
		return requested
	}
	var scopes []string
	for _, s := range strings.Fields(requested) {
		if s != ScopeWrite && s != ScopeRead {
			scopes = append(scopes, s)
		}
	}
	return strings.Join(append(scopes, ScopeRead), " ")
}

// enforceRedirectAllowlist rejects dynamic client registrations whose
// redirect URIs are not all trusted (MCP_ENFORCE_REDIRECT_ALLOWLIST), with
// the RFC 7591 invalid_redirect_uri error, before next (omniskill) runs.
func enforceRedirectAllowlist(next http.Handler, allow *redirectAllowlist) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			next.ServeHTTP(w, r)
			return
		}
		body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, maxRegistrationBody))
		if err != nil {
			writeRegistrationError(w, "invalid_client_metadata", "Failed to read the registration request")
			return
		}
		var meta struct {
			RedirectURIs []string `json:"redirect_uris"`
		}
		if err := json.Unmarshal(body, &meta); err != nil {
			writeRegistrationError(w, "invalid_client_metadata", "Invalid JSON")
			return
		}
		for _, uri := range meta.RedirectURIs {
			if !allow.trusted(uri) {
				writeRegistrationError(w, "invalid_redirect_uri", "redirect_uri is not on this server's allowlist")
				return
			}
		}
		r.Body = io.NopCloser(bytes.NewReader(body))
		r.ContentLength = int64(len(body))
		next.ServeHTTP(w, r)
	})
}

func writeRegistrationError(w http.ResponseWriter, code, description string) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(http.StatusBadRequest)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": code, "error_description": description})
}
