package txhelper

import (
	"context"
	"testing"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestFromContext_RequestContextWithTx verifies that a tx stored on a plain
// request context (what RLSMiddleware puts on c.Request) is returned, so
// handlers passing c.Request.Context() stay inside the RLS transaction.
func TestFromContext_RequestContextWithTx(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer func() { _ = db.Close() }()

	mock.ExpectBegin()
	tx, err := db.Begin()
	require.NoError(t, err)

	ctx := WithTx(context.Background(), tx)
	assert.Equal(t, tx, FromContext(ctx, db))

	// Derived contexts keep the tx.
	child, cancel := context.WithCancel(ctx)
	defer cancel()
	assert.Equal(t, tx, FromContext(child, db))

	mock.ExpectRollback()
	_ = tx.Rollback()
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestFromContext_NilContext(t *testing.T) {
	db, _, err := sqlmock.New()
	require.NoError(t, err)
	defer func() { _ = db.Close() }()

	//nolint:staticcheck // explicitly testing the nil guard
	assert.Equal(t, db, FromContext(nil, db))
}
