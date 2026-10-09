package middleware

import (
	"bufio"
	"bytes"
	"database/sql"
	"net"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	dto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/user"
	"github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/txhelper"
	"github.com/rs/zerolog/log"
)

// RLSMiddleware pins every authenticated request to a single *sql.Tx,
// sets two transaction-scoped PostgreSQL settings via set_config(), and
// stores the *sql.Tx both in the Gin context under "db_tx" and in
// c.Request's context (txhelper.WithTx), so repositories resolve it through
// txhelper.FromContext regardless of whether they receive the *gin.Context
// or c.Request.Context().
//
// Settings applied per request:
//   - app.current_user_id  — the authenticated user's ID
//   - app.is_admin         — "true" for ADMIN role, "false" otherwise
//
// Transaction outcome:
//   - The response is buffered while the handler runs, so the commit happens
//     BEFORE any byte reaches the client. If the commit fails the buffered
//     response is discarded and a 500 is returned instead — the client never
//     sees a success for data that was not persisted.
//   - The transaction is rolled back when the handler recorded errors
//     (c.Error) OR the response status is >= 400 (some handlers write an
//     error status without calling c.Error), and when the handler panics.
//   - Streaming responses (text/event-stream, explicit Flush or Hijack) are
//     not buffered: the writer switches to pass-through and the transaction
//     is finalised after the handler returns.
//
// Must be registered AFTER AuthMiddleware.
// Long-lived SSE endpoints should still be registered before this middleware
// so they do not hold a pooled connection for their whole lifetime.
func RLSMiddleware(db *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetString("X-User-Id")
		if userID == "" {
			c.Next()
			return
		}

		isAdmin := "false"
		if userVal, exists := c.Get("User"); exists {
			if userModel, ok := userVal.(*dto.UserResponse); ok && userModel.Role == "ADMIN" {
				isAdmin = "true"
			}
		}

		tx, err := db.BeginTx(c.Request.Context(), nil)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not begin transaction"})
			c.Abort()
			return
		}

		// set_config(name, value, is_local=true) is the parameterized equivalent of
		// SET LOCAL. PostgreSQL does not support $1 placeholders in SET commands.
		// is_local=true makes both settings transaction-scoped so they are
		// automatically cleared when the connection returns to the pool.
		_, err = tx.ExecContext(c.Request.Context(),
			"SELECT set_config('app.current_user_id', $1, true),"+
				"       set_config('app.is_admin', $2, true)",
			userID, isAdmin)
		if err != nil {
			_ = tx.Rollback()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not set rls context"})
			c.Abort()
			return
		}

		c.Set("db_tx", tx)
		c.Request = c.Request.WithContext(txhelper.WithTx(c.Request.Context(), tx))

		original := c.Writer
		bw := newBufferedResponseWriter(original)
		c.Writer = bw

		finished := false
		defer func() {
			if finished {
				return
			}
			// Panic path: never leak the transaction / pooled connection.
			_ = tx.Rollback()
			c.Writer = original
		}()

		c.Next()

		finished = true
		c.Writer = original

		failed := len(c.Errors) > 0 || bw.Status() >= http.StatusBadRequest
		if failed {
			if rbErr := tx.Rollback(); rbErr != nil && rbErr != sql.ErrTxDone {
				log.Warn().Err(rbErr).Str("path", c.Request.URL.Path).Msg("rls: rollback failed")
			}
			bw.flushTo(original)
			return
		}

		if commitErr := tx.Commit(); commitErr != nil {
			log.Error().Err(commitErr).Str("path", c.Request.URL.Path).Msg("rls: commit failed")
			if bw.streaming {
				// Bytes already went out; nothing more we can do.
				return
			}
			bw.discard()
			original.Header().Del("Content-Length")
			c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "could not commit transaction"})
			return
		}

		bw.flushTo(original)
	}
}

// bufferedResponseWriter holds the status and body produced by downstream
// handlers until RLSMiddleware decides the transaction outcome. Headers are
// written straight to the underlying header map (they are not sent until the
// status is flushed). It switches to pass-through for streaming responses.
type bufferedResponseWriter struct {
	gin.ResponseWriter
	buf         bytes.Buffer
	status      int
	wroteHeader bool
	streaming   bool
}

func newBufferedResponseWriter(w gin.ResponseWriter) *bufferedResponseWriter {
	// Start from the status already set on the real writer instead of a fixed
	// 200: for unmatched routes gin presets 404 (405 for wrong methods) before
	// running the global middleware chain, and resetting it here turned those
	// responses into an empty 200.
	return &bufferedResponseWriter{ResponseWriter: w, status: w.Status()}
}

func (w *bufferedResponseWriter) isEventStream() bool {
	return strings.HasPrefix(w.ResponseWriter.Header().Get("Content-Type"), "text/event-stream")
}

// startStreaming flushes whatever is buffered and turns the writer into a
// pass-through for the rest of the request.
func (w *bufferedResponseWriter) startStreaming() {
	if w.streaming {
		return
	}
	w.streaming = true
	if w.wroteHeader {
		w.ResponseWriter.WriteHeader(w.status)
		w.ResponseWriter.WriteHeaderNow()
	}
	if w.buf.Len() > 0 {
		_, _ = w.ResponseWriter.Write(w.buf.Bytes())
		w.buf.Reset()
	}
}

func (w *bufferedResponseWriter) WriteHeader(code int) {
	if w.streaming {
		w.ResponseWriter.WriteHeader(code)
		return
	}
	if code > 0 && !w.wroteHeader {
		w.status = code
	}
}

func (w *bufferedResponseWriter) WriteHeaderNow() {
	if w.streaming {
		w.ResponseWriter.WriteHeaderNow()
		return
	}
	w.wroteHeader = true
}

func (w *bufferedResponseWriter) Write(data []byte) (int, error) {
	if !w.streaming && w.isEventStream() {
		w.wroteHeader = true
		w.startStreaming()
	}
	if w.streaming {
		return w.ResponseWriter.Write(data)
	}
	w.wroteHeader = true
	return w.buf.Write(data)
}

func (w *bufferedResponseWriter) WriteString(s string) (int, error) {
	return w.Write([]byte(s))
}

func (w *bufferedResponseWriter) Status() int {
	if w.streaming {
		return w.ResponseWriter.Status()
	}
	return w.status
}

func (w *bufferedResponseWriter) Size() int {
	if w.streaming {
		return w.ResponseWriter.Size()
	}
	if !w.wroteHeader {
		return -1
	}
	return w.buf.Len()
}

func (w *bufferedResponseWriter) Written() bool {
	if w.streaming {
		return w.ResponseWriter.Written()
	}
	return w.wroteHeader
}

func (w *bufferedResponseWriter) Flush() {
	w.wroteHeader = true
	w.startStreaming()
	w.ResponseWriter.Flush()
}

func (w *bufferedResponseWriter) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	w.startStreaming()
	return w.ResponseWriter.Hijack()
}

func (w *bufferedResponseWriter) Unwrap() http.ResponseWriter {
	return w.ResponseWriter
}

// discard drops the buffered response (used when the commit fails).
func (w *bufferedResponseWriter) discard() {
	w.buf.Reset()
	w.wroteHeader = false
	w.status = http.StatusOK
}

// flushTo sends the buffered status and body to the real writer. If the
// handler produced nothing, the real writer is left untouched so outer
// middleware (ErrorHandler) can still write the response.
func (w *bufferedResponseWriter) flushTo(dst gin.ResponseWriter) {
	if w.streaming {
		return
	}
	// Propagate a status set via c.Status() even when nothing was written;
	// gin only sends it at the end of the request (WriteHeaderNow), so outer
	// middleware can still override it.
	dst.WriteHeader(w.status)
	if !w.wroteHeader {
		return
	}
	if w.buf.Len() > 0 {
		_, _ = dst.Write(w.buf.Bytes())
	} else {
		dst.WriteHeaderNow()
	}
}
