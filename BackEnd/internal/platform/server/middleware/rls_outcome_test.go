package middleware

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gin-gonic/gin"
	apperrors "github.com/osmait/gestorDePresupuesto/internal/platform/errors"
	"github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/txhelper"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// expectRLSBegin registers the Begin + set_config expectations.
func expectRLSBegin(mock sqlmock.Sqlmock, userID string) {
	mock.ExpectBegin()
	mock.ExpectExec(`SELECT set_config`).
		WithArgs(userID, "false", "15000", "30000").
		WillReturnResult(sqlmock.NewResult(0, 0))
}

// TestRLSMiddleware_TransactionOutcome checks commit vs rollback for the
// different ways a handler can finish.
func TestRLSMiddleware_TransactionOutcome(t *testing.T) {
	tests := []struct {
		name       string
		handler    gin.HandlerFunc
		wantCommit bool
		wantStatus int
		wantBody   string
	}{
		{
			name:       "2xx JSON commits",
			handler:    func(c *gin.Context) { c.JSON(http.StatusCreated, gin.H{"ok": true}) },
			wantCommit: true,
			wantStatus: http.StatusCreated,
			wantBody:   `{"ok":true}`,
		},
		{
			name:       "4xx without c.Error rolls back",
			handler:    func(c *gin.Context) { c.JSON(http.StatusBadRequest, gin.H{"error": "bad"}) },
			wantStatus: http.StatusBadRequest,
			wantBody:   `{"error":"bad"}`,
		},
		{
			name:       "5xx without c.Error rolls back",
			handler:    func(c *gin.Context) { c.JSON(http.StatusInternalServerError, gin.H{"error": "boom"}) },
			wantStatus: http.StatusInternalServerError,
			wantBody:   `{"error":"boom"}`,
		},
		{
			name:       "AbortWithStatus 403 rolls back",
			handler:    func(c *gin.Context) { c.AbortWithStatus(http.StatusForbidden) },
			wantStatus: http.StatusForbidden,
		},
		{
			name:       "status-only 409 rolls back and keeps status",
			handler:    func(c *gin.Context) { c.Status(http.StatusConflict) },
			wantStatus: http.StatusConflict,
		},
		{
			name:       "c.Error without body rolls back",
			handler:    func(c *gin.Context) { _ = c.Error(errors.New("domain failure")) },
			wantStatus: http.StatusOK, // no ErrorHandler in this chain
		},
		{
			name:       "204 commits",
			handler:    func(c *gin.Context) { c.Status(http.StatusNoContent) },
			wantCommit: true,
			wantStatus: http.StatusNoContent,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			db, mock, err := sqlmock.New()
			require.NoError(t, err)
			defer func() { _ = db.Close() }()

			expectRLSBegin(mock, "u1")
			if tc.wantCommit {
				mock.ExpectCommit()
			} else {
				mock.ExpectRollback()
			}

			gin.SetMode(gin.TestMode)
			r := gin.New()
			r.Use(injectUserContext("u1", nil), RLSMiddleware(db))
			r.GET("/x", tc.handler)

			w := httptest.NewRecorder()
			r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/x", nil))

			assert.Equal(t, tc.wantStatus, w.Code)
			if tc.wantBody != "" {
				assert.JSONEq(t, tc.wantBody, w.Body.String())
			}
			assert.NoError(t, mock.ExpectationsWereMet())
		})
	}
}

// TestRLSMiddleware_CommitFailureReturns500 verifies commit-before-response:
// when the commit fails, the client never sees the handler's success body.
func TestRLSMiddleware_CommitFailureReturns500(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer func() { _ = db.Close() }()

	expectRLSBegin(mock, "u1")
	mock.ExpectCommit().WillReturnError(errors.New("could not serialize access"))

	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(injectUserContext("u1", nil), RLSMiddleware(db))
	r.POST("/transfer", func(c *gin.Context) {
		c.JSON(http.StatusCreated, gin.H{"id": "tx-123", "status": "created"})
	})

	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodPost, "/transfer", nil))

	assert.Equal(t, http.StatusInternalServerError, w.Code)
	assert.NotContains(t, w.Body.String(), "tx-123")
	assert.Contains(t, w.Body.String(), "could not commit transaction")
	assert.NoError(t, mock.ExpectationsWereMet())
}

// TestRLSMiddleware_ResponseNotSentBeforeCommit asserts ordering: while the
// handler runs (i.e. before the commit) the client has received nothing.
func TestRLSMiddleware_ResponseNotSentBeforeCommit(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer func() { _ = db.Close() }()

	expectRLSBegin(mock, "u1")
	mock.ExpectCommit()

	w := httptest.NewRecorder()
	var writtenDuringHandler bool

	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(injectUserContext("u1", nil), RLSMiddleware(db))
	r.GET("/x", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
		writtenDuringHandler = w.Body.Len() > 0
	})
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/x", nil))

	assert.False(t, writtenDuringHandler, "body must be buffered until the commit")
	assert.Equal(t, http.StatusOK, w.Code)
	assert.JSONEq(t, `{"ok":true}`, w.Body.String())
	assert.NoError(t, mock.ExpectationsWereMet())
}

// TestRLSMiddleware_TxAvailableInRequestContext ensures repositories that get
// c.Request.Context() (not the gin.Context) resolve the same transaction.
func TestRLSMiddleware_TxAvailableInRequestContext(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer func() { _ = db.Close() }()

	expectRLSBegin(mock, "u1")
	mock.ExpectCommit()

	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(injectUserContext("u1", nil), RLSMiddleware(db))
	r.GET("/x", func(c *gin.Context) {
		ginTx, _ := c.Get("db_tx")
		fromReq := txhelper.FromContext(c.Request.Context(), db)
		fromGin := txhelper.FromContext(c, db)
		c.JSON(http.StatusOK, gin.H{
			"req_is_tx": fromReq == ginTx,
			"gin_is_tx": fromGin == ginTx,
		})
	})

	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/x", nil))
	assert.JSONEq(t, `{"req_is_tx":true,"gin_is_tx":true}`, w.Body.String())
	assert.NoError(t, mock.ExpectationsWereMet())
}

// TestRLSMiddleware_PanicRollsBack ensures a panicking handler does not leak
// the transaction (and its pooled connection).
func TestRLSMiddleware_PanicRollsBack(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer func() { _ = db.Close() }()

	expectRLSBegin(mock, "u1")
	mock.ExpectRollback()

	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(ErrorHandler(DefaultErrorHandlerConfig()))
	r.Use(injectUserContext("u1", nil), RLSMiddleware(db))
	r.GET("/x", func(c *gin.Context) { panic("kaboom") })

	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/x", nil))
	assert.Equal(t, http.StatusInternalServerError, w.Code)
	assert.NoError(t, mock.ExpectationsWereMet())
}

// TestRLSMiddleware_ErrorHandlerStillWrites verifies the buffered writer does
// not swallow the response written by the outer ErrorHandler on c.Error.
func TestRLSMiddleware_ErrorHandlerStillWrites(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer func() { _ = db.Close() }()

	expectRLSBegin(mock, "u1")
	mock.ExpectRollback()

	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(ErrorHandler(DefaultErrorHandlerConfig()))
	r.Use(injectUserContext("u1", nil), RLSMiddleware(db))
	r.GET("/x", func(c *gin.Context) {
		_ = c.Error(apperrors.NewNotFoundError("account", "a1"))
	})

	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/x", nil))
	assert.Equal(t, http.StatusNotFound, w.Code)
	assert.NotEmpty(t, w.Body.String())
	assert.NoError(t, mock.ExpectationsWereMet())
}

// TestRLSMiddleware_StreamingPassThrough verifies event streams are not
// buffered (they would otherwise never reach the client).
func TestRLSMiddleware_StreamingPassThrough(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer func() { _ = db.Close() }()

	expectRLSBegin(mock, "u1")
	mock.ExpectCommit()

	w := httptest.NewRecorder()
	var sawFirstChunk bool

	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(injectUserContext("u1", nil), RLSMiddleware(db))
	r.GET("/events", func(c *gin.Context) {
		c.Header("Content-Type", "text/event-stream")
		c.Status(http.StatusOK)
		_, _ = c.Writer.WriteString("data: one\n\n")
		c.Writer.Flush()
		sawFirstChunk = strings.Contains(w.Body.String(), "data: one")
		_, _ = c.Writer.WriteString("data: two\n\n")
	})
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/events", nil))

	assert.True(t, sawFirstChunk, "stream chunk must reach the client immediately")
	assert.Equal(t, "data: one\n\ndata: two\n\n", w.Body.String())
	assert.NoError(t, mock.ExpectationsWereMet())
}

// TestRLSMiddleware_UnknownRouteKeeps404 is a regression test: gin presets
// 404 on the writer before running the global middleware chain for an
// unmatched route, and the buffered writer used to reset it to 200, so
// authenticated requests to unknown paths got an empty 200 instead of 404.
func TestRLSMiddleware_UnknownRouteKeeps404(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer func() { _ = db.Close() }()

	expectRLSBegin(mock, "u1")
	mock.ExpectRollback()

	r := newRLSRouter(injectUserContext("u1", nil), RLSMiddleware(db))

	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/category/does-not-exist", nil))

	assert.Equal(t, http.StatusNotFound, w.Code)
	assert.Equal(t, "404 page not found", w.Body.String())
	assert.NoError(t, mock.ExpectationsWereMet())
}
