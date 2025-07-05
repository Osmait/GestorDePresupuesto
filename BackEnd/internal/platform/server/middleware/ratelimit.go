package middleware

import (
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/osmait/gestorDePresupuesto/internal/config"
	"golang.org/x/time/rate"
)

// RateLimitStore maintains rate limiters for different clients
type RateLimitStore struct {
	limiters map[string]*rate.Limiter
	mu       sync.RWMutex
	config   *config.Config
}

// NewRateLimitStore creates a new rate limit store
func NewRateLimitStore(config *config.Config) *RateLimitStore {
	store := &RateLimitStore{
		limiters: make(map[string]*rate.Limiter),
		config:   config,
	}

	// Start cleanup goroutine to remove old limiters
	go store.cleanupRoutine()

	return store
}

// getLimiter returns a rate limiter for the given key (IP address or user ID)
func (rls *RateLimitStore) getLimiter(key string) *rate.Limiter {
	rls.mu.Lock()
	defer rls.mu.Unlock()

	limiter, exists := rls.limiters[key]
	if !exists {
		// Create new limiter with configured rate and burst
		limiter = rate.NewLimiter(
			rate.Every(rls.config.RateLimitWindow/time.Duration(rls.config.RateLimitRequests)),
			rls.config.RateLimitBurst,
		)
		rls.limiters[key] = limiter
	}

	return limiter
}

// cleanupRoutine periodically removes unused limiters to prevent memory leaks
func (rls *RateLimitStore) cleanupRoutine() {
	ticker := time.NewTicker(time.Hour) // Cleanup every hour
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			rls.mu.Lock()
			// Simple cleanup: remove all limiters
			// In production, you might want more sophisticated cleanup
			rls.limiters = make(map[string]*rate.Limiter)
			rls.mu.Unlock()
		}
	}
}

// RateLimitByIP applies rate limiting based on client IP address
func RateLimitByIP(store *RateLimitStore) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !store.config.RateLimitEnabled {
			c.Next()
			return
		}

		// Skip rate limiting for certain endpoints
		if shouldSkipRateLimit(c.Request.URL.Path) {
			c.Next()
			return
		}

		// Get client IP
		clientIP := getClientIP(c)

		// Get or create limiter for this IP
		limiter := store.getLimiter(clientIP)

		// Check if request is allowed
		if !limiter.Allow() {
			c.Header("X-RateLimit-Limit", fmt.Sprintf("%d", store.config.RateLimitRequests))
			c.Header("X-RateLimit-Window", store.config.RateLimitWindow.String())
			c.Header("Retry-After", "60") // Suggest retry after 60 seconds

			c.JSON(http.StatusTooManyRequests, gin.H{
				"error":       "rate limit exceeded",
				"message":     "too many requests from this IP address",
				"retry_after": "60 seconds",
			})
			c.Abort()
			return
		}

		// Add rate limit headers to response
		c.Header("X-RateLimit-Limit", fmt.Sprintf("%d", store.config.RateLimitRequests))
		c.Header("X-RateLimit-Window", store.config.RateLimitWindow.String())

		c.Next()
	}
}

// RateLimitByUser applies rate limiting based on authenticated user
func RateLimitByUser(store *RateLimitStore) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !store.config.RateLimitEnabled {
			c.Next()
			return
		}

		// Skip rate limiting for certain endpoints
		if shouldSkipRateLimit(c.Request.URL.Path) {
			c.Next()
			return
		}

		// Get user ID from context (set by auth middleware)
		userID, exists := c.Get("X-User-Id")
		if !exists {
			// No user context, skip user-based rate limiting
			c.Next()
			return
		}

		userIDStr, ok := userID.(string)
		if !ok {
			// Invalid user ID format, skip rate limiting
			c.Next()
			return
		}

		// Create unique key for user rate limiting
		key := fmt.Sprintf("user:%s", userIDStr)

		// Get or create limiter for this user
		limiter := store.getLimiter(key)

		// Check if request is allowed
		if !limiter.Allow() {
			c.Header("X-RateLimit-Limit", fmt.Sprintf("%d", store.config.RateLimitRequests))
			c.Header("X-RateLimit-Window", store.config.RateLimitWindow.String())
			c.Header("Retry-After", "60")

			c.JSON(http.StatusTooManyRequests, gin.H{
				"error":       "rate limit exceeded",
				"message":     "too many requests from this user",
				"retry_after": "60 seconds",
			})
			c.Abort()
			return
		}

		// Add rate limit headers to response
		c.Header("X-RateLimit-Limit", fmt.Sprintf("%d", store.config.RateLimitRequests))
		c.Header("X-RateLimit-Window", store.config.RateLimitWindow.String())

		c.Next()
	}
}

// StrictRateLimit applies stricter rate limiting for sensitive endpoints
func StrictRateLimit(store *RateLimitStore, requestsPerMinute int) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !store.config.RateLimitEnabled {
			c.Next()
			return
		}

		// Get client identifier (prefer user ID, fallback to IP)
		var key string
		if userID, exists := c.Get("X-User-Id"); exists {
			if userIDStr, ok := userID.(string); ok {
				key = fmt.Sprintf("strict:user:%s", userIDStr)
			}
		}

		if key == "" {
			key = fmt.Sprintf("strict:ip:%s", getClientIP(c))
		}

		// Create limiter with stricter limits
		strictLimiter := rate.NewLimiter(
			rate.Every(time.Minute/time.Duration(requestsPerMinute)),
			requestsPerMinute/2, // Lower burst capacity for strict endpoints
		)

		// Check if request is allowed
		if !strictLimiter.Allow() {
			c.Header("X-RateLimit-Limit", fmt.Sprintf("%d", requestsPerMinute))
			c.Header("X-RateLimit-Window", "1m")
			c.Header("Retry-After", "120")

			c.JSON(http.StatusTooManyRequests, gin.H{
				"error":       "strict rate limit exceeded",
				"message":     "too many requests to sensitive endpoint",
				"retry_after": "2 minutes",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// LoginRateLimit applies specific rate limiting for login endpoints
func LoginRateLimit(store *RateLimitStore) gin.HandlerFunc {
	return StrictRateLimit(store, 10) // 10 login attempts per minute
}

// TransactionRateLimit applies specific rate limiting for financial transactions
func TransactionRateLimit(store *RateLimitStore) gin.HandlerFunc {
	return StrictRateLimit(store, 30) // 30 transactions per minute
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

// RateLimitConfig holds rate limiting configuration for specific endpoints
type RateLimitConfig struct {
	RequestsPerMinute int
	BurstCapacity     int
	WindowDuration    time.Duration
}

// CustomRateLimit creates a rate limiter with custom configuration
func CustomRateLimit(store *RateLimitStore, config RateLimitConfig) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !store.config.RateLimitEnabled {
			c.Next()
			return
		}

		// Get client identifier
		clientIP := getClientIP(c)
		key := fmt.Sprintf("custom:%s:%s", c.Request.URL.Path, clientIP)

		// Get or create limiter for this key
		limiter := store.getLimiter(key)

		if !limiter.Allow() {
			c.Header("X-RateLimit-Limit", fmt.Sprintf("%d", config.RequestsPerMinute))
			c.Header("X-RateLimit-Window", config.WindowDuration.String())
			c.Header("Retry-After", "60")

			c.JSON(http.StatusTooManyRequests, gin.H{
				"error":       "custom rate limit exceeded",
				"message":     "too many requests to this endpoint",
				"retry_after": "60 seconds",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}
