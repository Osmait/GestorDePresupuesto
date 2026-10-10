package telemetry

import (
	"crypto/subtle"
	"net/http"
	"strings"
)

// BearerAuth protects h with a static bearer token compared in constant time.
// An empty token rejects every request (fail closed).
func BearerAuth(token string, h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !ValidBearer(r.Header.Get("Authorization"), token) {
			w.Header().Set("WWW-Authenticate", `Bearer realm="metrics"`)
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		h.ServeHTTP(w, r)
	})
}

// ValidBearer reports whether the Authorization header carries "Bearer
// <token>". It always returns false for an empty expected token.
func ValidBearer(header, token string) bool {
	if token == "" {
		return false
	}
	const prefix = "Bearer "
	if len(header) <= len(prefix) || !strings.EqualFold(header[:len(prefix)], prefix) {
		return false
	}
	got := strings.TrimSpace(header[len(prefix):])
	return subtle.ConstantTimeCompare([]byte(got), []byte(token)) == 1
}
