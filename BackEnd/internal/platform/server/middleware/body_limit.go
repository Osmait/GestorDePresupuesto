package middleware

import (
	"bytes"
	"errors"
	"io"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// BodyLimit caps request bodies and reads them completely before the request
// goes on.
//
// Reading the body up front matters because RLSMiddleware takes a pooled
// database connection before the handler binds the body: a client sending its
// body slowly would otherwise hold one of the few connections for the whole
// read timeout, and ~25 such requests (any logged-in user, even a demo one)
// exhaust the pool for everyone. Here the slow read only ties up a goroutine.
// The cap also stops multi-GB bodies before they are decoded in memory.
//
// limits maps path prefixes to their own cap (e.g. /ai/ uploads); every other
// path gets defaultMax. Requests without a body are passed through untouched.
func BodyLimit(defaultMax int64, limits map[string]int64) gin.HandlerFunc {
	return func(c *gin.Context) {
		req := c.Request
		if req.Body == nil || req.Body == http.NoBody || req.ContentLength == 0 {
			c.Next()
			return
		}

		max := defaultMax
		for prefix, limit := range limits {
			if strings.HasPrefix(req.URL.Path, prefix) {
				max = limit
				break
			}
		}
		if req.ContentLength > max {
			c.AbortWithStatusJSON(http.StatusRequestEntityTooLarge, gin.H{"error": "request body too large"})
			return
		}

		body, err := io.ReadAll(http.MaxBytesReader(c.Writer, req.Body, max))
		_ = req.Body.Close()
		if err != nil {
			var tooLarge *http.MaxBytesError
			if errors.As(err, &tooLarge) {
				c.AbortWithStatusJSON(http.StatusRequestEntityTooLarge, gin.H{"error": "request body too large"})
				return
			}
			c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": "could not read request body"})
			return
		}
		req.Body = io.NopCloser(bytes.NewReader(body))
		req.ContentLength = int64(len(body))
		c.Next()
	}
}
