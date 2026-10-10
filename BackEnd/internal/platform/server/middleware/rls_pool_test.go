package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gin-gonic/gin"
	"github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/txhelper"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestRLSMiddleware_PoolExhaustedFailsFast: when every pooled connection is
// busy the request must not queue forever; it gets 503 + Retry-After once
// the acquire timeout elapses.
func TestRLSMiddleware_PoolExhaustedFailsFast(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer func() { _ = db.Close() }()
	db.SetMaxOpenConns(1)

	// Occupy the only connection.
	held, err := db.Conn(context.Background())
	require.NoError(t, err)
	defer func() { _ = held.Close() }()

	r := newRLSRouter(injectUserContext("u1", nil), RLSMiddlewareWithTimeout(db, 50*time.Millisecond))

	start := time.Now()
	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/protected", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusServiceUnavailable, w.Code)
	assert.Equal(t, "1", w.Header().Get("Retry-After"))
	assert.Less(t, time.Since(start), 2*time.Second, "must fail fast, not wait for the request context")
	assert.NoError(t, mock.ExpectationsWereMet(), "no transaction may be opened")
}

// TestRLSMiddleware_AcquireTimeoutDoesNotBoundTheTransaction: the acquire
// deadline covers getting the connection only; a handler running longer than
// it still commits.
func TestRLSMiddleware_AcquireTimeoutDoesNotBoundTheTransaction(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer func() { _ = db.Close() }()

	mock.ExpectBegin()
	mock.ExpectExec(`SELECT set_config`).WithArgs("u1", "false").WillReturnResult(sqlmock.NewResult(0, 0))
	mock.ExpectCommit()

	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(injectUserContext("u1", nil), RLSMiddlewareWithTimeout(db, 20*time.Millisecond))
	r.GET("/slow", func(c *gin.Context) {
		time.Sleep(60 * time.Millisecond)
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/slow", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.NoError(t, mock.ExpectationsWereMet())
}

// TestRLSMiddleware_RunsAfterTxHooksAfterCommit: callbacks registered with
// txhelper.AfterTx run only once the transaction has been committed.
func TestRLSMiddleware_RunsAfterTxHooksAfterCommit(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer func() { _ = db.Close() }()

	mock.ExpectBegin()
	mock.ExpectExec(`SELECT set_config`).WithArgs("u1", "false").WillReturnResult(sqlmock.NewResult(0, 0))
	mock.ExpectCommit()

	ranInHandler, ranAfter := false, false
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Next()
		// Outer middleware: by now RLSMiddleware has committed and run hooks.
		assert.True(t, ranAfter, "hook must have run when RLSMiddleware returns")
	})
	r.Use(injectUserContext("u1", nil), RLSMiddleware(db))
	r.GET("/write", func(c *gin.Context) {
		txhelper.AfterTx(c.Request.Context(), func() { ranAfter = true })
		ranInHandler = !ranAfter
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/write", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.True(t, ranInHandler, "hook must not run while the transaction is open")
	assert.True(t, ranAfter)
	assert.NoError(t, mock.ExpectationsWereMet())
}
