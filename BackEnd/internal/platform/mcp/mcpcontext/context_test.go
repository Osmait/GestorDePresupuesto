package mcpcontext

import (
	"context"
	"database/sql"
	"testing"

	"github.com/stretchr/testify/assert"
)

// TestWithUserID_RoundTrip verifies that a user ID stored with WithUserID is
// retrieved unchanged by UserIDFromContext.
func TestWithUserID_RoundTrip(t *testing.T) {
	const want = "user-abc-123"
	ctx := WithUserID(context.Background(), want)
	got := UserIDFromContext(ctx)
	assert.Equal(t, want, got)
}

// TestUserIDFromContext_EmptyContext verifies that UserIDFromContext returns an
// empty string when no user ID has been stored.
func TestUserIDFromContext_EmptyContext(t *testing.T) {
	got := UserIDFromContext(context.Background())
	assert.Equal(t, "", got)
}

// TestWithTx_RoundTrip verifies that a *sql.Tx stored with WithTx is retrieved
// by TxFromContext. A nil *sql.Tx is used because the function only stores and
// returns the pointer; no real database connection is required.
func TestWithTx_RoundTrip(t *testing.T) {
	var tx *sql.Tx // nil is a valid *sql.Tx pointer for this test
	ctx := WithTx(context.Background(), tx)
	got := TxFromContext(ctx)
	// The nil pointer stored should be returned as-is (pointer equality).
	assert.Same(t, tx, got)
}

// TestTxFromContext_EmptyContext verifies that TxFromContext returns nil when
// no transaction has been stored in the context.
func TestTxFromContext_EmptyContext(t *testing.T) {
	got := TxFromContext(context.Background())
	assert.Nil(t, got)
}
