package middleware

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/gin-gonic/gin"
	dto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/user"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// injectUserContext simulates what AuthMiddleware does for authenticated requests.
func injectUserContext(userID string, user *dto.UserResponse) gin.HandlerFunc {
	return func(c *gin.Context) {
		if userID != "" {
			c.Set("X-User-Id", userID)
		}
		if user != nil {
			c.Set("User", user)
		}
		c.Next()
	}
}

// newRLSRouter builds a Gin engine with optional auth context injection + RLSMiddleware + a capture handler.
func newRLSRouter(mw ...gin.HandlerFunc) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	for _, m := range mw {
		r.Use(m)
	}
	r.GET("/protected", func(c *gin.Context) {
		_, hasTx := c.Get("db_tx")
		c.JSON(http.StatusOK, gin.H{"tx": hasTx})
	})
	return r
}

// TestRLSMiddleware_SkipsUnauthenticated ensures that requests with no X-User-Id
// pass through without opening a DB transaction.
func TestRLSMiddleware_SkipsUnauthenticated(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	// No DB expectations — no transaction should be opened.
	r := newRLSRouter(RLSMiddleware(db))

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/protected", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), `"tx":false`)
	assert.NoError(t, mock.ExpectationsWereMet())
}

// TestRLSMiddleware_SetsTransactionForAuthenticatedUser verifies that the middleware
// opens a transaction, calls set_config with the user ID, stores db_tx in context,
// and commits after a successful handler.
func TestRLSMiddleware_SetsTransactionForAuthenticatedUser(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	userID := "user-abc-123"

	// set_config('app.current_user_id', $1, true) — only $1 is a Go arg.
	mock.ExpectBegin()
	mock.ExpectExec(`SELECT set_config`).
		WithArgs(userID).
		WillReturnResult(sqlmock.NewResult(0, 0))
	mock.ExpectCommit()

	r := newRLSRouter(
		injectUserContext(userID, nil),
		RLSMiddleware(db),
	)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/protected", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), `"tx":true`)
	assert.NoError(t, mock.ExpectationsWereMet())
}

// TestRLSMiddleware_AdminUserGetsSentinelValue verifies that ADMIN role users
// get "__admin__" instead of their actual user ID set in the RLS context.
func TestRLSMiddleware_AdminUserGetsSentinelValue(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	userID := "admin-user-id"
	adminUser := &dto.UserResponse{Role: "ADMIN"}

	// Expect sentinel "__admin__", NOT the actual userID.
	mock.ExpectBegin()
	mock.ExpectExec(`SELECT set_config`).
		WithArgs("__admin__").
		WillReturnResult(sqlmock.NewResult(0, 0))
	mock.ExpectCommit()

	r := newRLSRouter(
		injectUserContext(userID, adminUser),
		RLSMiddleware(db),
	)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/protected", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.NoError(t, mock.ExpectationsWereMet())
}

// TestRLSMiddleware_RollsBackOnHandlerError verifies that when the handler
// adds an error to the Gin context, the transaction is rolled back, not committed.
func TestRLSMiddleware_RollsBackOnHandlerError(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	userID := "user-abc-123"

	mock.ExpectBegin()
	mock.ExpectExec(`SELECT set_config`).
		WithArgs(userID).
		WillReturnResult(sqlmock.NewResult(0, 0))
	mock.ExpectRollback() // Rollback, NOT Commit

	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(injectUserContext(userID, nil))
	r.Use(RLSMiddleware(db))
	r.GET("/protected", func(c *gin.Context) {
		_ = c.Error(errors.New("something went wrong downstream"))
		c.JSON(http.StatusInternalServerError, gin.H{"error": "internal"})
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/protected", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusInternalServerError, w.Code)
	assert.NoError(t, mock.ExpectationsWereMet())
}

// TestRLSMiddleware_Returns500WhenBeginTxFails verifies that a DB pool error
// on BeginTx returns 500 to the client.
func TestRLSMiddleware_Returns500WhenBeginTxFails(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	mock.ExpectBegin().WillReturnError(errors.New("connection pool exhausted"))

	r := newRLSRouter(
		injectUserContext("user-123", nil),
		RLSMiddleware(db),
	)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/protected", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusInternalServerError, w.Code)
	assert.Contains(t, w.Body.String(), "could not begin transaction")
	assert.NoError(t, mock.ExpectationsWereMet())
}

// TestRLSMiddleware_Returns500WhenSetConfigFails verifies that a failure
// in set_config returns 500 and rolls back the transaction.
// This is the exact regression test for the original bug where
// "SET LOCAL app.current_user_id = $1" was used instead of set_config().
func TestRLSMiddleware_Returns500WhenSetConfigFails(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer db.Close()

	mock.ExpectBegin()
	mock.ExpectExec(`SELECT set_config`).
		WillReturnError(errors.New("unrecognized configuration parameter"))
	mock.ExpectRollback()

	r := newRLSRouter(
		injectUserContext("user-123", nil),
		RLSMiddleware(db),
	)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/protected", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusInternalServerError, w.Code)
	assert.Contains(t, w.Body.String(), "could not set rls context")
	assert.NoError(t, mock.ExpectationsWereMet())
}
