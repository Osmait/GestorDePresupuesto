package middleware

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/osmait/gestorDePresupuesto/internal/config"
)

// rateEntry is the sliding-window state of a single rate-limit key. The
// window is stored per key because endpoint-specific limits (e.g. /auth/demo,
// 1h) can be much longer than the global window; cleanup must not drop them
// early.
type rateEntry struct {
	hits   []time.Time
	window time.Duration
}

// RateLimitStore represents a rate limiting store
type RateLimitStore struct {
	entries map[string]*rateEntry
	mu      sync.Mutex
	config  *config.Config
}

// NewRateLimitStore creates a new rate limiting store
func NewRateLimitStore(config *config.Config) *RateLimitStore {
	return &RateLimitStore{
		entries: make(map[string]*rateEntry),
		config:  config,
	}
}

// RateLimitService provides rate limiting functionality
type RateLimitService struct {
	store  *RateLimitStore
	config *config.Config
	now    func() time.Time
}

// NewRateLimitService creates a new rate limiting service
func NewRateLimitService(config *config.Config) *RateLimitService {
	return &RateLimitService{
		store:  NewRateLimitStore(config),
		config: config,
		now:    time.Now,
	}
}

// pruneLocked drops hits older than the window. Caller holds the lock.
func pruneLocked(hits []time.Time, now time.Time, window time.Duration) []time.Time {
	kept := hits[:0]
	for _, h := range hits {
		if now.Sub(h) <= window {
			kept = append(kept, h)
		}
	}
	return kept
}

// IsAllowed checks if a request should be allowed based on rate limits and,
// when it is, records it.
func (rls *RateLimitService) IsAllowed(key string, limit int, window time.Duration, burst int) bool {
	allowed, _ := rls.allow(key, limit, window, burst)
	return allowed
}

// allow records the request when permitted and returns the remaining quota.
func (rls *RateLimitService) allow(key string, limit int, window time.Duration, burst int) (bool, int) {
	rls.store.mu.Lock()
	defer rls.store.mu.Unlock()

	now := rls.now()
	entry, ok := rls.store.entries[key]
	if !ok {
		entry = &rateEntry{}
		rls.store.entries[key] = entry
	}
	if window > entry.window {
		entry.window = window
	}
	entry.hits = pruneLocked(entry.hits, now, window)

	if len(entry.hits) >= limit+burst {
		return false, 0
	}

	entry.hits = append(entry.hits, now)
	remaining := limit - len(entry.hits)
	if remaining < 0 {
		remaining = 0
	}
	return true, remaining
}

// isIPWhitelisted checks if an IP is in the whitelist
func (store *RateLimitStore) isIPWhitelisted(ip string) bool {
	if !store.config.RateLimit.Enabled {
		return true
	}

	parsedIP := net.ParseIP(ip)
	if parsedIP == nil {
		return false
	}

	for _, whitelistedIP := range store.config.RateLimit.IPWhitelist {
		if whitelistedIP == ip {
			return true
		}
		// Proper CIDR check
		if strings.Contains(whitelistedIP, "/") {
			_, network, err := net.ParseCIDR(whitelistedIP)
			if err == nil && network.Contains(parsedIP) {
				return true
			}
		}
	}
	return false
}

// generateRateLimitKey generates a key for rate limiting.
//
// The IP comes from gin's ClientIP(), which only honours X-Forwarded-For /
// X-Real-IP when the TCP peer is a configured trusted proxy (see
// server.ConfigureClientIP). Never derive the key from raw headers here.
func (rls *RateLimitService) generateRateLimitKey(c *gin.Context) string {
	// If user-based rate limiting is enabled and user is authenticated
	if rls.config.RateLimit.UserBased {
		if userID, exists := c.Get("X-User-Id"); exists {
			if id, ok := userID.(string); ok && id != "" {
				return "user:" + id
			}
		}
	}

	// Fall back to IP-based rate limiting
	return "ip:" + c.ClientIP()
}

// matchEndpointConfig matches the request method and path to an endpoint
// configuration.
func (rls *RateLimitService) matchEndpointConfig(method, path string) *config.EndpointRateLimitConfig {
	for i := range rls.config.RateLimit.Endpoints {
		endpoint := &rls.config.RateLimit.Endpoints[i]
		if len(endpoint.Methods) > 0 && !slices.Contains(endpoint.Methods, method) {
			continue
		}
		// support wildcard at the end (e.g. /api/auth/*)
		if strings.HasSuffix(endpoint.Path, "*") {
			prefix := strings.TrimSuffix(endpoint.Path, "*")
			if strings.HasPrefix(path, prefix) {
				return endpoint
			}
		} else if path == endpoint.Path {
			return endpoint
		}
	}
	return nil
}

// Middleware returns the gin handler enforcing the configured limits.
func (rls *RateLimitService) Middleware() gin.HandlerFunc {
	cfg := rls.config
	return func(c *gin.Context) {
		// Skip rate limiting if disabled
		if !cfg.RateLimit.Enabled {
			c.Next()
			return
		}

		// Check IP whitelist
		if rls.store.isIPWhitelisted(c.ClientIP()) {
			c.Next()
			return
		}

		// Determine limits based on endpoint or global config
		limit := cfg.RateLimit.Requests
		window := cfg.RateLimit.Window
		burst := cfg.RateLimit.Burst

		endpointConfig := rls.matchEndpointConfig(c.Request.Method, c.Request.URL.Path)
		if endpointConfig != nil {
			limit = endpointConfig.Requests
			window = endpointConfig.Window
			burst = endpointConfig.Burst
		}

		// Generate rate limit key (append path if endpoint specific to isolate quotas)
		key := rls.generateRateLimitKey(c)
		if endpointConfig != nil {
			if endpointConfig.Bucket != "" {
				key = key + ":bucket:" + endpointConfig.Bucket
			} else {
				key = key + ":" + endpointConfig.Path
			}
		}

		allowed, remaining := rls.allow(key, limit, window, burst)
		if !allowed {
			c.Header("Retry-After", fmt.Sprintf("%d", int(window.Seconds())))
			c.AbortWithStatusJSON(http.StatusTooManyRequests, gin.H{
				"error":       "rate limit exceeded",
				"retry_after": window.Seconds(),
			})
			return
		}

		// Add rate limit headers
		c.Header("X-RateLimit-Limit", fmt.Sprintf("%d", limit))
		c.Header("X-RateLimit-Window", window.String())
		c.Header("X-RateLimit-Remaining", fmt.Sprintf("%d", remaining))

		c.Next()
	}
}

// RateLimitMiddleware creates a rate limiting middleware without background
// cleanup. Long-running servers should use NewRateLimitService +
// StartCleanup + Middleware so the key map does not grow without bound.
func RateLimitMiddleware(config *config.Config) gin.HandlerFunc {
	return NewRateLimitService(config).Middleware()
}

// StartCleanup periodically evicts expired rate-limit entries until ctx is
// cancelled. The returned channel is closed once the goroutine has exited.
func (rls *RateLimitService) StartCleanup(ctx context.Context, interval time.Duration) <-chan struct{} {
	if interval <= 0 {
		interval = rls.config.RateLimit.Window
	}
	if interval <= 0 {
		interval = time.Minute
	}
	done := make(chan struct{})
	ticker := time.NewTicker(interval)
	go func() {
		defer close(done)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				rls.cleanup()
			}
		}
	}()
	return done
}

// cleanup removes expired rate limit entries.
func (rls *RateLimitService) cleanup() {
	rls.store.mu.Lock()
	defer rls.store.mu.Unlock()

	now := rls.now()
	for key, entry := range rls.store.entries {
		entry.hits = pruneLocked(entry.hits, now, entry.window)
		if len(entry.hits) == 0 {
			delete(rls.store.entries, key)
		}
	}
}

// size returns the number of tracked keys (used by tests).
func (rls *RateLimitService) size() int {
	rls.store.mu.Lock()
	defer rls.store.mu.Unlock()
	return len(rls.store.entries)
}
