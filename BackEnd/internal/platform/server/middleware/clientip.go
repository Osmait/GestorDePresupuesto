package middleware

import (
	"fmt"

	"github.com/gin-gonic/gin"
	"github.com/osmait/gestorDePresupuesto/internal/config"
)

// ConfigureClientIP makes gin's ClientIP() trustworthy.
//
// By default gin trusts X-Forwarded-For from ANY peer, so a client can spoof
// its IP (bypassing per-IP rate limits, or matching the 127.0.0.1 whitelist).
// This trusts forwarding headers only from the configured proxies:
//
//   - TRUSTED_PROXIES (IPs/CIDRs): X-Forwarded-For / X-Real-IP are honoured
//     only when the TCP peer is in this list; gin walks X-Forwarded-For right
//     to left skipping trusted hops, so client-supplied entries are ignored.
//   - TRUSTED_PLATFORM_HEADER: a header set by the hosting platform's edge
//     (e.g. X-Real-IP on Railway) that is trusted unconditionally.
//
// With neither set (the default) nobody is trusted and the TCP peer address
// is the client IP.
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
	engine.TrustedPlatform = cfg.TrustedPlatformHeader
	return nil
}
