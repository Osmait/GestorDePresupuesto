package txhelper

import (
	"context"
	"net/http/httptest"
	"testing"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	"github.com/gin-gonic/gin"
	"github.com/osmait/gestorDePresupuesto/internal/platform/mcp/mcpcontext"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestFromContext_NoTxInContext verifies that when neither Gin nor MCP context
// carries a transaction, FromContext falls back to the provided *sql.DB.
func TestFromContext_NoTxInContext(t *testing.T) {
	db, _, err := sqlmock.New()
	require.NoError(t, err)
	defer func() { _ = db.Close() }()

	result := FromContext(context.Background(), db)

	assert.Equal(t, db, result, "expected fallback to *sql.DB when no tx is present")
}

// TestFromContext_MCPContextWithTx verifies that a transaction stored in an MCP
// context via mcpcontext.WithTx is returned by FromContext.
func TestFromContext_MCPContextWithTx(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer func() { _ = db.Close() }()

	mock.ExpectBegin()
	tx, err := db.Begin()
	require.NoError(t, err)

	ctx := mcpcontext.WithTx(context.Background(), tx)
	result := FromContext(ctx, db)

	assert.Equal(t, tx, result, "expected the MCP-injected *sql.Tx to be returned")

	// Roll back to satisfy sqlmock expectations.
	mock.ExpectRollback()
	_ = tx.Rollback()
	assert.NoError(t, mock.ExpectationsWereMet())
}

// TestFromContext_GinWinsOverMCP verifies the documented precedence: when both a
// Gin context with "db_tx" and an MCP context transaction are present, the Gin
// transaction wins (existing behaviour is preserved).
func TestFromContext_GinWinsOverMCP(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer func() { _ = db.Close() }()

	// Create two transactions: one for Gin, one for MCP.
	mock.ExpectBegin()
	ginTx, err := db.Begin()
	require.NoError(t, err)

	mock.ExpectBegin()
	mcpTx, err := db.Begin()
	require.NoError(t, err)

	// Build a Gin context with the Gin transaction stored under "db_tx".
	gin.SetMode(gin.TestMode)
	w := httptest.NewRecorder()
	ginCtx, _ := gin.CreateTestContext(w)
	// Attach a real request so ginCtx.Request is not nil.
	ginCtx.Request = httptest.NewRequest("GET", "/", nil)
	ginCtx.Set("db_tx", ginTx)

	// Store the MCP transaction in an mcpcontext-wrapped plain context.
	// Then embed the Gin context into the request context so FromContext can find it.
	ctx := mcpcontext.WithTx(ginCtx.Request.Context(), mcpTx)
	ginCtx.Request = ginCtx.Request.WithContext(ctx)

	result := FromContext(ginCtx, db)

	assert.Equal(t, ginTx, result, "expected Gin db_tx to take precedence over MCP tx")

	// Clean up both transactions.
	mock.ExpectRollback()
	_ = ginTx.Rollback()
	mock.ExpectRollback()
	_ = mcpTx.Rollback()
	assert.NoError(t, mock.ExpectationsWereMet())
}
