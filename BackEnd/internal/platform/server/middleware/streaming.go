package middleware

import (
	"context"
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

// EndOnShutdown is a route middleware for long-lived streaming endpoints: the
// request context is cancelled when shutdown is cancelled (the server starts
// shutting down), so the stream handler returns and http.Server.Shutdown
// does not wait for the client to disconnect.
func EndOnShutdown(shutdown context.Context) gin.HandlerFunc {
	return func(c *gin.Context) {
		if shutdown == nil {
			c.Next()
			return
		}
		ctx, cancel := context.WithCancel(c.Request.Context())
		stop := context.AfterFunc(shutdown, cancel)
		defer func() {
			stop()
			cancel()
		}()
		c.Request = c.Request.WithContext(ctx)
		c.Next()
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
