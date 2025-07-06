package middleware

import (
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/osmait/gestorDePresupuesto/internal/config"
)

// RateLimitStore represents a rate limiting store
type RateLimitStore struct {
	requests map[string][]time.Time
	mu       sync.RWMutex
	config   *config.Config
}

// NewRateLimitStore creates a new rate limiting store
func NewRateLimitStore(config *config.Config) *RateLimitStore {
	return &RateLimitStore{
		requests: make(map[string][]time.Time),
		config:   config,
	}
}

// RateLimitService provides rate limiting functionality
type RateLimitService struct {
	store  *RateLimitStore
	config *config.Config
}

// NewRateLimitService creates a new rate limiting service
func NewRateLimitService(config *config.Config) *RateLimitService {
	return &RateLimitService{
		store:  NewRateLimitStore(config),
		config: config,
	}
}

// IsAllowed checks if a request should be allowed based on rate limits
func (rls *RateLimitService) IsAllowed(key string) bool {
	rls.store.mu.Lock()
	defer rls.store.mu.Unlock()

	now := time.Now()
	window := rls.config.RateLimit.Window
	limit := rls.config.RateLimit.Requests
	burst := rls.config.RateLimit.Burst

	// Get current requests for this key
	requests, exists := rls.store.requests[key]
	if !exists {
		requests = []time.Time{}
	}

	// Remove old requests outside the window
	validRequests := []time.Time{}
	for _, req := range requests {
		if now.Sub(req) <= window {
			validRequests = append(validRequests, req)
		}
	}

	// Check if we're within limits
	if len(validRequests) >= limit {
		// Check if we can allow burst traffic
		if len(validRequests) >= limit+burst {
			return false
		}
	}

	// Add current request
	validRequests = append(validRequests, now)
	rls.store.requests[key] = validRequests

	return true
}

// isIPWhitelisted checks if an IP is in the whitelist
func (store *RateLimitStore) isIPWhitelisted(ip string) bool {
	if !store.config.RateLimit.Enabled {
		return true
	}

	for _, whitelistedIP := range store.config.RateLimit.IPWhitelist {
		if ip == whitelistedIP {
			return true
		}
		// Simple CIDR check (basic implementation)
		if strings.Contains(whitelistedIP, "/") && strings.HasPrefix(ip, strings.Split(whitelistedIP, "/")[0]) {
			return true
		}
	}
	return false
}

// generateRateLimitKey generates a key for rate limiting
func (rls *RateLimitService) generateRateLimitKey(c *gin.Context) string {
	// If user-based rate limiting is enabled and user is authenticated
	if rls.config.RateLimit.UserBased {
		if userID, exists := c.Get("X-User-Id"); exists {
			return "user:" + userID.(string)
		}
	}

	// Fall back to IP-based rate limiting
	return "ip:" + c.ClientIP()
}

// RateLimitMiddleware creates a rate limiting middleware
func RateLimitMiddleware(config *config.Config) gin.HandlerFunc {
	service := NewRateLimitService(config)

	return func(c *gin.Context) {
		// Skip rate limiting if disabled
		if !config.RateLimit.Enabled {
			c.Next()
			return
		}

		// Check IP whitelist
		if service.store.isIPWhitelisted(c.ClientIP()) {
			c.Next()
			return
		}

		// Generate rate limit key
		key := service.generateRateLimitKey(c)

		// Check if request is allowed
		if !service.IsAllowed(key) {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error":       "rate limit exceeded",
				"retry_after": config.RateLimit.Window.Seconds(),
			})
			c.Abort()
			return
		}

		// Add rate limit headers
		c.Header("X-RateLimit-Limit", fmt.Sprintf("%d", config.RateLimit.Requests))
		c.Header("X-RateLimit-Window", config.RateLimit.Window.String())
		c.Header("X-RateLimit-Remaining", fmt.Sprintf("%d", getRemainingRequests(service, key)))

		c.Next()
	}
}

// getRemainingRequests calculates remaining requests for a key
func getRemainingRequests(service *RateLimitService, key string) int {
	service.store.mu.RLock()
	defer service.store.mu.RUnlock()

	requests, exists := service.store.requests[key]
	if !exists {
		return service.config.RateLimit.Requests
	}

	now := time.Now()
	window := service.config.RateLimit.Window

	// Count valid requests within the window
	validCount := 0
	for _, req := range requests {
		if now.Sub(req) <= window {
			validCount++
		}
	}

	remaining := service.config.RateLimit.Requests - validCount
	if remaining < 0 {
		return 0
	}
	return remaining
}

// IPRateLimitMiddleware creates an IP-based rate limiting middleware
func IPRateLimitMiddleware(config *config.Config) gin.HandlerFunc {
	service := NewRateLimitService(config)

	return func(c *gin.Context) {
		if !config.RateLimit.Enabled {
			c.Next()
			return
		}

		key := "ip:" + c.ClientIP()

		if !service.IsAllowed(key) {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error":       "IP rate limit exceeded",
				"retry_after": config.RateLimit.Window.Seconds(),
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// UserRateLimitMiddleware creates a user-based rate limiting middleware
func UserRateLimitMiddleware(config *config.Config) gin.HandlerFunc {
	service := NewRateLimitService(config)

	return func(c *gin.Context) {
		if !config.RateLimit.Enabled {
			c.Next()
			return
		}

		userID, exists := c.Get("X-User-Id")
		if !exists {
			c.Next()
			return
		}

		key := "user:" + userID.(string)

		if !service.IsAllowed(key) {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error":       "user rate limit exceeded",
				"retry_after": config.RateLimit.Window.Seconds(),
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// CleanupMiddleware periodically cleans up old rate limit entries
func (rls *RateLimitService) CleanupMiddleware() {
	ticker := time.NewTicker(rls.config.RateLimit.Window)
	go func() {
		for {
			select {
			case <-ticker.C:
				rls.cleanup()
			}
		}
	}()
}

// cleanup removes old rate limit entries
func (rls *RateLimitService) cleanup() {
	rls.store.mu.Lock()
	defer rls.store.mu.Unlock()

	now := time.Now()
	window := rls.config.RateLimit.Window

	for key, requests := range rls.store.requests {
		validRequests := []time.Time{}
		for _, req := range requests {
			if now.Sub(req) <= window {
				validRequests = append(validRequests, req)
			}
		}

		if len(validRequests) == 0 {
			delete(rls.store.requests, key)
		} else {
			rls.store.requests[key] = validRequests
		}
	}
}

// getClientIP extracts the real client IP address from various headers
func getClientIP(c *gin.Context) string {
	// Check X-Forwarded-For header (most common with proxies)
	xForwardedFor := c.GetHeader("X-Forwarded-For")
	if xForwardedFor != "" {
		// X-Forwarded-For can contain multiple IPs, take the first one
		ips := strings.Split(xForwardedFor, ",")
		if len(ips) > 0 {
			return strings.TrimSpace(ips[0])
		}
	}

	// Check X-Real-IP header (common with nginx)
	xRealIP := c.GetHeader("X-Real-IP")
	if xRealIP != "" {
		return strings.TrimSpace(xRealIP)
	}

	// Check CF-Connecting-IP (Cloudflare)
	cfConnectingIP := c.GetHeader("CF-Connecting-IP")
	if cfConnectingIP != "" {
		return strings.TrimSpace(cfConnectingIP)
	}

	// Fallback to remote address
	return c.ClientIP()
}

// shouldSkipRateLimit determines if rate limiting should be skipped for certain endpoints
func shouldSkipRateLimit(path string) bool {
	skipPaths := []string{
		"/health",
		"/ping",
		"/metrics",
		"/favicon.ico",
	}

	for _, skipPath := range skipPaths {
		if strings.Contains(path, skipPath) {
			return true
		}
	}

	return false
}
