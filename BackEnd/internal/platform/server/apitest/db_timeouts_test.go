package apitest

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/osmait/gestorDePresupuesto/internal/platform/server/middleware"
	"github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/txhelper"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// timeoutEngine is the request path of an authenticated route: ErrorHandler
// outside, then RLSMiddleware, then a handler that runs query on the
// request transaction (optionally after sleeping, idle in the transaction).
func timeoutEngine(db *sql.DB, cfg middleware.RLSConfig, idle time.Duration, query string) *gin.Engine {
	r := gin.New()
	r.Use(middleware.ErrorHandler(middleware.DefaultErrorHandlerConfig()))
	r.Use(func(c *gin.Context) {
		c.Set("X-User-Id", "timeout-user")
		c.Next()
	})
	r.Use(middleware.RLSMiddlewareWithConfig(db, cfg))
	r.GET("/q", func(c *gin.Context) {
		ctx := c.Request.Context()
		if idle > 0 {
			time.Sleep(idle)
		}
		if _, err := txhelper.FromContext(ctx, db).ExecContext(ctx, query); err != nil {
			_ = c.Error(err)
			return
		}
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})
	return r
}

func withSessionLimits(t *testing.T, l txhelper.SessionLimits) {
	t.Helper()
	prev := txhelper.CurrentSessionLimits()
	txhelper.ConfigureSessionLimits(l)
	t.Cleanup(func() { txhelper.ConfigureSessionLimits(prev) })
}

func serve(r *gin.Engine) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/q", nil))
	return w
}

// assertReleased checks the pool got its connection back and still works.
func assertReleased(t *testing.T, db *sql.DB) {
	t.Helper()
	require.Eventually(t, func() bool { return db.Stats().InUse == 0 }, 2*time.Second, 10*time.Millisecond,
		"the request must release its pooled connection")
	var one int
	require.NoError(t, db.QueryRow("SELECT 1").Scan(&one))
}

func newLimitedPool(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("postgres", testConnStr)
	require.NoError(t, err)
	db.SetMaxOpenConns(1)
	t.Cleanup(func() { _ = db.Close() })
	return db
}

func TestRLS_StatementTimeoutFailsCleanlyAndReleasesTheConnection(t *testing.T) {
	gin.SetMode(gin.TestMode)
	withSessionLimits(t, txhelper.SessionLimits{StatementTimeout: 200 * time.Millisecond, IdleInTxTimeout: 5 * time.Second})
	db := newLimitedPool(t)
	r := timeoutEngine(db, middleware.RLSConfig{AcquireTimeout: time.Second}, 0, "SELECT pg_sleep(3)")

	start := time.Now()
	w := serve(r)
	assert.Less(t, time.Since(start), 2*time.Second, "the statement must be cancelled at the timeout")
	assert.Equal(t, http.StatusServiceUnavailable, w.Code, w.Body.String())
	assert.NotEmpty(t, w.Header().Get("Retry-After"))
	var body map[string]any
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body), "clean JSON error body")
	assertReleased(t, db)

	// The setting is transaction-local: a later quick query on the same
	// (single) pooled connection is not affected.
	ok := timeoutEngine(db, middleware.RLSConfig{AcquireTimeout: time.Second}, 0, "SELECT pg_sleep(0.05)")
	assert.Equal(t, http.StatusOK, serve(ok).Code)
}

func TestRLS_IdleInTransactionTimeoutReleasesTheConnection(t *testing.T) {
	gin.SetMode(gin.TestMode)
	withSessionLimits(t, txhelper.SessionLimits{StatementTimeout: 5 * time.Second, IdleInTxTimeout: 200 * time.Millisecond})
	db := newLimitedPool(t)
	// The handler sits idle inside the transaction past the limit: the
	// server ends the session and the next statement fails.
	r := timeoutEngine(db, middleware.RLSConfig{AcquireTimeout: time.Second}, 800*time.Millisecond, "SELECT 1")

	w := serve(r)
	assert.GreaterOrEqual(t, w.Code, http.StatusInternalServerError, w.Body.String())
	assertReleased(t, db)

	ok := timeoutEngine(db, middleware.RLSConfig{AcquireTimeout: time.Second}, 0, "SELECT 1")
	assert.Equal(t, http.StatusOK, serve(ok).Code, "the pool replaces the terminated connection")
}

func TestRLS_RequestDeadlineFailsCleanlyAndReleasesTheConnection(t *testing.T) {
	gin.SetMode(gin.TestMode)
	withSessionLimits(t, txhelper.SessionLimits{})
	db := newLimitedPool(t)
	r := timeoutEngine(db, middleware.RLSConfig{AcquireTimeout: time.Second, RequestTimeout: 300 * time.Millisecond}, 0, "SELECT pg_sleep(3)")

	start := time.Now()
	w := serve(r)
	assert.Less(t, time.Since(start), 2*time.Second)
	assert.Equal(t, http.StatusServiceUnavailable, w.Code, w.Body.String())
	assertReleased(t, db)
}
