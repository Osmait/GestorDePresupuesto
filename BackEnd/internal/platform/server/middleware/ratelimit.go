package middleware

import (
	"fmt"
	"net"
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
func (rls *RateLimitService) IsAllowed(key string, limit int, window time.Duration, burst int) bool {
	rls.store.mu.Lock()
	defer rls.store.mu.Unlock()

	now := time.Now()

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

// matchEndpointConfig matches the request path to an endpoint configuration
func (rls *RateLimitService) matchEndpointConfig(path string) *config.EndpointRateLimitConfig {
	for _, endpoint := range rls.config.RateLimit.Endpoints {
		// support wildcard at the end (e.g. /api/auth/*)
		if strings.HasSuffix(endpoint.Path, "*") {
			prefix := strings.TrimSuffix(endpoint.Path, "*")
			if strings.HasPrefix(path, prefix) {
				return &endpoint
			}
		} else {
			if path == endpoint.Path {
				return &endpoint
			}
		}
	}
	return nil
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

		// Determine limits based on endpoint or global config
		limit := config.RateLimit.Requests
		window := config.RateLimit.Window
		burst := config.RateLimit.Burst

		endpointConfig := service.matchEndpointConfig(c.Request.URL.Path)
		if endpointConfig != nil {
			limit = endpointConfig.Requests
			window = endpointConfig.Window
			burst = endpointConfig.Burst
		}

		// Generate rate limit key (append path if endpoint specific to isolate quotas)
		baseKey := service.generateRateLimitKey(c)
		key := baseKey
		if endpointConfig != nil {
			key = baseKey + ":" + endpointConfig.Path
		}

		// Check if request is allowed
		if !service.IsAllowed(key, limit, window, burst) {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error":       "rate limit exceeded",
				"retry_after": window.Seconds(),
			})
			c.Abort()
			return
		}

		// Add rate limit headers
		c.Header("X-RateLimit-Limit", fmt.Sprintf("%d", limit))
		c.Header("X-RateLimit-Window", window.String())
		c.Header("X-RateLimit-Remaining", fmt.Sprintf("%d", getRemainingRequests(service, key, limit, window)))

		c.Next()
	}
}

// getRemainingRequests calculates remaining requests for a key
func getRemainingRequests(service *RateLimitService, key string, limit int, window time.Duration) int {
	service.store.mu.RLock()
	defer service.store.mu.RUnlock()

	requests, exists := service.store.requests[key]
	if !exists {
		return limit
	}

	now := time.Now()

	// Count valid requests within the window
	validCount := 0
	for _, req := range requests {
		if now.Sub(req) <= window {
			validCount++
		}
	}

	remaining := limit - validCount
	if remaining < 0 {
		return 0
	}
	return remaining
}

// IPRateLimitMiddleware creates an IP-based rate limiting middleware
func IPRateLimitMiddleware(config *config.Config) gin.HandlerFunc {
	return RateLimitMiddleware(config) // Re-use main middleware logic which falls back to IP
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

		if !service.IsAllowed(key, config.RateLimit.Requests, config.RateLimit.Window, config.RateLimit.Burst) {
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
		for range ticker.C {
			rls.cleanup()
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
