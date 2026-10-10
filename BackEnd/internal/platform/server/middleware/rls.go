package middleware

import (
	"bufio"
	"bytes"
	"context"
	"database/sql"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	dto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/user"
	"github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/txhelper"
	"github.com/rs/zerolog/log"
)

// DefaultTxAcquireTimeout is how long RLSMiddleware waits for a pooled
// connection when no explicit timeout is configured (DB_TX_ACQUIRE_TIMEOUT).
const DefaultTxAcquireTimeout = 5 * time.Second

// RLSMiddleware is RLSMiddlewareWithTimeout with DefaultTxAcquireTimeout.
func RLSMiddleware(db *sql.DB) gin.HandlerFunc {
	return RLSMiddlewareWithTimeout(db, DefaultTxAcquireTimeout)
}

// RLSMiddlewareWithTimeout pins every authenticated request to a single
// *sql.Tx, sets two transaction-scoped PostgreSQL settings via set_config(),
// and stores the *sql.Tx both in the Gin context under "db_tx" and in
// c.Request's context (txhelper.WithTx), so repositories resolve it through
// txhelper.FromContext regardless of whether they receive the *gin.Context
// or c.Request.Context().
//
// Settings applied per request:
//   - app.current_user_id  — the authenticated user's ID
//   - app.is_admin         — "true" for ADMIN role, "false" otherwise
//
// Connection budget: the request holds exactly ONE pooled connection for its
// whole lifetime. Every query reachable from a handler must run on the
// request transaction (txhelper.FromContext / txhelper.InTx); a query on the
// plain *sql.DB needs a second connection and, once the pool is exhausted by
// requests in that same situation, they all wait for each other forever.
//
// Bounded wait: the connection for the request transaction is acquired with
// a deadline of acquireTimeout (DB_TX_ACQUIRE_TIMEOUT). When the pool stays
// exhausted for that long the request fails fast with 503 + Retry-After
// instead of queueing indefinitely. acquireTimeout <= 0 disables the bound
// (the request context still applies). The deadline only covers acquisition:
// the transaction itself lives as long as the request context.
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
//   - Callbacks registered with txhelper.AfterTx (cache invalidation) run
//     after the transaction has been committed or rolled back; those
//     registered with txhelper.AfterCommit (notifications) only after a
//     successful commit.
//
// Must be registered AFTER AuthMiddleware.
// Long-lived SSE endpoints, and handlers that manage their own transactions
// (e.g. the recurring-transaction processor), must be registered before this
// middleware so they do not hold a pooled connection while waiting for
// another one.
func RLSMiddlewareWithTimeout(db *sql.DB, acquireTimeout time.Duration) gin.HandlerFunc {
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

		reqCtx := c.Request.Context()
		conn, err := acquireConn(reqCtx, db, acquireTimeout)
		if err != nil {
			stats := db.Stats()
			log.Warn().Err(err).
				Str("path", c.Request.URL.Path).
				Int("pool_in_use", stats.InUse).
				Int("pool_max_open", stats.MaxOpenConnections).
				Int64("pool_wait_count", stats.WaitCount).
				Dur("acquire_timeout", acquireTimeout).
				Msg("rls: could not acquire a database connection")
			c.Header("Retry-After", "1")
			c.AbortWithStatusJSON(http.StatusServiceUnavailable, gin.H{"error": "database busy, please retry"})
			return
		}

		tx, err := conn.BeginTx(reqCtx, nil)
		if err != nil {
			_ = conn.Close()
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not begin transaction"})
			c.Abort()
			return
		}

		hooks := txhelper.NewTxHooks()
		original := c.Writer
		finished := false
		var bw *bufferedResponseWriter
		defer func() {
			if !finished {
				// Error / panic path: never leak the transaction or the
				// pooled connection.
				_ = tx.Rollback()
				c.Writer = original
			}
			if bw != nil {
				// The buffered body has been copied out (or discarded) and
				// c.Writer no longer points at bw.
				releaseBufferedResponseWriter(bw)
			}
			// The transaction is over (committed or rolled back): return the
			// connection to the pool, then run post-transaction callbacks.
			_ = conn.Close()
			hooks.Run()
		}()

		// set_config(name, value, is_local=true) is the parameterized equivalent of
		// SET LOCAL. PostgreSQL does not support $1 placeholders in SET commands.
		// is_local=true makes both settings transaction-scoped so they are
		// automatically cleared when the connection returns to the pool.
		_, err = tx.ExecContext(reqCtx,
			"SELECT set_config('app.current_user_id', $1, true),"+
				"       set_config('app.is_admin', $2, true)",
			userID, isAdmin)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "could not set rls context"})
			c.Abort()
			return
		}

		c.Set("db_tx", tx)
		txhelper.SetGinTxHooks(c, hooks)
		c.Request = c.Request.WithContext(txhelper.WithTxHooks(txhelper.WithTx(reqCtx, tx), hooks))

		bw = newBufferedResponseWriter(original)
		c.Writer = bw

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
		hooks.MarkCommitted()

		bw.flushTo(original)
	}
}

// acquireConn reserves one pooled connection, waiting at most timeout (when
// positive) on top of ctx. The deadline applies to the acquisition only: the
// returned *sql.Conn is not bound to it.
func acquireConn(ctx context.Context, db *sql.DB, timeout time.Duration) (*sql.Conn, error) {
	if timeout <= 0 {
		return db.Conn(ctx)
	}
	acquireCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	return db.Conn(acquireCtx)
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

const (
	// initialResponseBufferSize pre-sizes a fresh buffer: most JSON
	// responses fit, so the buffer does not regrow (and copy) several times.
	initialResponseBufferSize = 4 << 10
	// maxPooledResponseBuffer caps the buffers returned to the pool, so a
	// rare multi-megabyte response does not stay pinned in memory.
	maxPooledResponseBuffer = 256 << 10
)

// bufferedWriterPool recycles bufferedResponseWriters and their buffers: one
// per authenticated request was a top allocation source under load.
var bufferedWriterPool = sync.Pool{
	New: func() any {
		w := &bufferedResponseWriter{}
		w.buf.Grow(initialResponseBufferSize)
		return w
	},
}

func newBufferedResponseWriter(w gin.ResponseWriter) *bufferedResponseWriter {
	bw := bufferedWriterPool.Get().(*bufferedResponseWriter)
	bw.ResponseWriter = w
	// Start from the status already set on the real writer instead of a fixed
	// 200: for unmatched routes gin presets 404 (405 for wrong methods) before
	// running the global middleware chain, and resetting it here turned those
	// responses into an empty 200.
	bw.status = w.Status()
	return bw
}

// releaseBufferedResponseWriter returns w to the pool. w must not be used
// afterwards.
func releaseBufferedResponseWriter(w *bufferedResponseWriter) {
	buf := w.buf
	buf.Reset()
	if buf.Cap() > maxPooledResponseBuffer {
		buf = bytes.Buffer{}
		buf.Grow(initialResponseBufferSize)
	}
	*w = bufferedResponseWriter{buf: buf}
	bufferedWriterPool.Put(w)
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
