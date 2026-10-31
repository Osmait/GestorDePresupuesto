package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
)

// ConcurrencyLimit caps how many requests run the rest of the chain at once,
// across all users. A request beyond the cap is rejected immediately with
// 503 + Retry-After instead of queueing. Use it in front of slow calls to a
// paid third-party service (the AI provider): per-user quotas alone still let
// many users together pile up goroutines and upstream calls. max <= 0
// disables the cap.
func ConcurrencyLimit(name string, max int) gin.HandlerFunc {
	if max <= 0 {
		return func(c *gin.Context) { c.Next() }
	}
	slots := make(chan struct{}, max)
	return func(c *gin.Context) {
		select {
		case slots <- struct{}{}:
			defer func() { <-slots }()
			c.Next()
		default:
			log.Ctx(c.Request.Context()).Warn().
				Str("limit", name).Int("max_concurrent", max).
				Str("path", c.Request.URL.Path).
				Msg("concurrency limit reached; rejecting request")
			c.Header("Retry-After", "5")
			c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{
				"error": "service busy, please retry shortly",
				"code":  "CONCURRENCY_LIMIT",
			})
		}
	}
}
