package middleware

import (
	"errors"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
)

// ClearConnDeadlines removes the server-wide read/write deadlines
// (http.Server ReadTimeout / WriteTimeout) for the current connection so a
// long-lived streaming response (SSE) is not cut off. The ReadTimeout also has
// to go: once it fires, net/http's background reader cancels the request
// context, which would end the stream.
func ClearConnDeadlines(w http.ResponseWriter) {
	rc := http.NewResponseController(w)
	if err := rc.SetWriteDeadline(time.Time{}); err != nil && !errors.Is(err, http.ErrNotSupported) {
		log.Warn().Err(err).Msg("streaming: could not clear write deadline")
	}
	if err := rc.SetReadDeadline(time.Time{}); err != nil && !errors.Is(err, http.ErrNotSupported) {
		log.Warn().Err(err).Msg("streaming: could not clear read deadline")
	}
}

// StreamingNoDeadline is a route middleware for long-lived streaming
// endpoints (SSE). It must only be attached to such routes: everything else
// keeps the server timeouts.
func StreamingNoDeadline() gin.HandlerFunc {
	return func(c *gin.Context) {
		ClearConnDeadlines(c.Writer)
		c.Next()
	}
}
