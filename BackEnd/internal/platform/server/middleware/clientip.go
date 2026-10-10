package middleware

import (
	"crypto/sha256"
	"crypto/subtle"
	"fmt"
	"net/netip"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/osmait/gestorDePresupuesto/internal/config"
)

const (
	// ResolvedClientIPHeader is an internal request header holding the client
	// IP resolved by the client IP middleware; gin's ClientIP() reads it
	// (engine.TrustedPlatform). Any value sent by a caller is discarded.
	ResolvedClientIPHeader = "X-Gestor-Client-Ip"
	// ProxySecretHeader carries PROXY_SHARED_SECRET from the frontend server.
	ProxySecretHeader = "X-Proxy-Secret"
	// ProxyClientIPHeader carries the end user's IP as seen by the frontend
	// server. It is only honoured together with a valid ProxySecretHeader.
	ProxyClientIPHeader = "X-Client-Ip"
)

// ConfigureClientIP makes gin's ClientIP() trustworthy. It must be called
// before any other middleware is registered: when PROXY_SHARED_SECRET or
// TRUSTED_PLATFORM_HEADER is configured it installs the middleware that
// resolves the client IP, which has to run first.
//
// By default gin trusts X-Forwarded-For from ANY peer, so a client can spoof
// its IP (bypassing per-IP rate limits, or matching the 127.0.0.1 whitelist).
// The client IP is resolved, in order, from:
//
//  1. PROXY_SHARED_SECRET: the frontend server (Next.js proxy, Server
//     Components, next-auth) calls the backend on behalf of browsers, so the
//     TCP peer / platform header is the frontend's egress IP for everyone. It
//     sends the browser's IP in X-Client-IP plus the secret in X-Proxy-Secret;
//     the IP is honoured only when the secret matches. A missing or wrong
//     secret is not an error: the request falls through to the next source
//     (direct callers such as MCP clients never send it).
//  2. TRUSTED_PLATFORM_HEADER: a header set by the hosting platform's edge
//     (e.g. X-Real-IP on Railway), trusted unconditionally.
//  3. TRUSTED_PROXIES (IPs/CIDRs): X-Forwarded-For / X-Real-IP are honoured
//     only when the TCP peer is in this list; gin walks X-Forwarded-For right
//     to left skipping trusted hops, so client-supplied entries are ignored.
//  4. The TCP peer address (the default when nothing is configured).
//
// X-Proxy-Secret and X-Client-IP are removed from the request before any
// later middleware or handler runs, so they are never logged or forwarded.
func ConfigureClientIP(engine *gin.Engine, cfg config.ServerConfig) error {
	var proxies []string
	if len(cfg.TrustedProxies) > 0 {
		proxies = cfg.TrustedProxies
	}
	if err := engine.SetTrustedProxies(proxies); err != nil {
		return fmt.Errorf("invalid TRUSTED_PROXIES: %w", err)
	}
	engine.ForwardedByClientIP = true
	engine.RemoteIPHeaders = []string{"X-Forwarded-For", "X-Real-IP"}
	engine.TrustedPlatform = ""

	if cfg.ProxySharedSecret == "" && cfg.TrustedPlatformHeader == "" {
		return nil
	}
	engine.TrustedPlatform = ResolvedClientIPHeader
	engine.Use(resolveClientIP(cfg.ProxySharedSecret, cfg.TrustedPlatformHeader))
	return nil
}

// resolveClientIP writes the resolved client IP (if any) into
// ResolvedClientIPHeader and strips the proxy headers from the request.
func resolveClientIP(secret, platformHeader string) gin.HandlerFunc {
	secretSum := sha256.Sum256([]byte(secret))
	return func(c *gin.Context) {
		h := c.Request.Header

		ip := ""
		if secret != "" {
			if got := h.Get(ProxySecretHeader); got != "" && secretMatches(got, secretSum) {
				ip = parseClientIP(h.Get(ProxyClientIPHeader))
			}
		}
		if ip == "" && platformHeader != "" {
			ip = parseClientIP(h.Get(platformHeader))
		}

		h.Del(ResolvedClientIPHeader)
		h.Del(ProxySecretHeader)
		h.Del(ProxyClientIPHeader)
		if ip != "" {
			h.Set(ResolvedClientIPHeader, ip)
		}
		c.Next()
	}
}

// secretMatches compares in constant time; hashing both sides first also
// keeps the comparison from revealing the secret's length.
func secretMatches(got string, want [sha256.Size]byte) bool {
	sum := sha256.Sum256([]byte(got))
	return subtle.ConstantTimeCompare(sum[:], want[:]) == 1
}

// parseClientIP returns the canonical form of a single IP address, or "" when
// the value is not one. IPv4-mapped IPv6 addresses are unmapped and zones
// dropped so a client always maps to the same rate-limit key.
func parseClientIP(value string) string {
	addr, err := netip.ParseAddr(strings.TrimSpace(value))
	if err != nil {
		return ""
	}
	return addr.Unmap().WithZone("").String()
}
