package middleware

import (
	"context"
	"database/sql"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/txhelper"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const flagQuery = `SELECT COALESCE\(g.enabled, o.enabled, f.default_enabled\)`

// requestTxContext returns a context carrying a (mocked) request
// transaction, as route gates see it under RLSMiddleware.
func requestTxContext(t *testing.T, mock sqlmock.Sqlmock, db interface {
	Begin() (*sql.Tx, error)
}) context.Context {
	t.Helper()
	mock.ExpectBegin()
	tx, err := db.Begin()
	require.NoError(t, err)
	return txhelper.WithTx(context.Background(), tx)
}

// Routes registered before RLSMiddleware (the AI provider routes) have no
// request transaction: the lookup opens a short one scoped to the user, so
// per-user overrides stay visible under row level security.
func TestFeatureFlags_WithoutRequestTxUsesAShortUserTx(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer func() { _ = db.Close() }()

	flags := NewFeatureFlags(db, 0)
	mock.ExpectBegin()
	mock.ExpectExec(`SELECT set_config`).WithArgs("u1", "false", "15000", "30000").
		WillReturnResult(sqlmock.NewResult(0, 0))
	mock.ExpectQuery(flagQuery).WithArgs("u1", "ai_extraction").
		WillReturnRows(sqlmock.NewRows([]string{"enabled"}).AddRow(true))
	mock.ExpectCommit()

	enabled, err := flags.Enabled(context.Background(), "u1", "ai_extraction")
	require.NoError(t, err)
	assert.True(t, enabled)
	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestFeatureFlags_CachesAndInvalidates(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer func() { _ = db.Close() }()

	now := time.Unix(1_700_000_000, 0)
	flags := NewFeatureFlags(db, 30*time.Second)
	flags.now = func() time.Time { return now }
	ctx := requestTxContext(t, mock, db)

	// First evaluation hits the database.
	mock.ExpectQuery(flagQuery).WithArgs("u1", "module_loans").
		WillReturnRows(sqlmock.NewRows([]string{"enabled"}).AddRow(true))
	enabled, err := flags.Enabled(ctx, "u1", "module_loans")
	require.NoError(t, err)
	assert.True(t, enabled)

	// Second one is served from the cache (no query expected).
	enabled, err = flags.Enabled(ctx, "u1", "module_loans")
	require.NoError(t, err)
	assert.True(t, enabled)
	require.NoError(t, mock.ExpectationsWereMet())

	// Other users are cached separately.
	mock.ExpectQuery(flagQuery).WithArgs("u2", "module_loans").
		WillReturnRows(sqlmock.NewRows([]string{"enabled"}).AddRow(false))
	enabled, err = flags.Enabled(ctx, "u2", "module_loans")
	require.NoError(t, err)
	assert.False(t, enabled)

	// An admin update invalidates: the next evaluation queries again.
	flags.Invalidate()
	mock.ExpectQuery(flagQuery).WithArgs("u1", "module_loans").
		WillReturnRows(sqlmock.NewRows([]string{"enabled"}).AddRow(false))
	enabled, err = flags.Enabled(ctx, "u1", "module_loans")
	require.NoError(t, err)
	assert.False(t, enabled)

	// Entries expire after the TTL.
	now = now.Add(31 * time.Second)
	mock.ExpectQuery(flagQuery).WithArgs("u1", "module_loans").
		WillReturnRows(sqlmock.NewRows([]string{"enabled"}).AddRow(true))
	enabled, err = flags.Enabled(ctx, "u1", "module_loans")
	require.NoError(t, err)
	assert.True(t, enabled)

	// Unknown flags are disabled.
	mock.ExpectQuery(flagQuery).WithArgs("u1", "nope").
		WillReturnRows(sqlmock.NewRows([]string{"enabled"}))
	enabled, err = flags.Enabled(ctx, "u1", "nope")
	require.NoError(t, err)
	assert.False(t, enabled)

	assert.NoError(t, mock.ExpectationsWereMet())
}

func TestFeatureFlags_ZeroTTLDisablesCache(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer func() { _ = db.Close() }()

	flags := NewFeatureFlags(db, 0)
	ctx := requestTxContext(t, mock, db)
	for i := 0; i < 2; i++ {
		mock.ExpectQuery(flagQuery).WithArgs("u1", "module_loans").
			WillReturnRows(sqlmock.NewRows([]string{"enabled"}).AddRow(true))
		enabled, err := flags.Enabled(ctx, "u1", "module_loans")
		require.NoError(t, err)
		assert.True(t, enabled)
	}
	assert.NoError(t, mock.ExpectationsWereMet())
}

// A value read while an invalidation happens must not be cached (it may
// predate the admin change).
func TestFeatureFlags_DoesNotCacheAcrossInvalidation(t *testing.T) {
	flags := NewFeatureFlags(nil, time.Minute)
	k := featureCacheKey{userID: "u1", key: "k"}
	_, generation, ok := flags.lookup(k)
	require.False(t, ok)
	flags.Invalidate()
	flags.store(k, true, generation)
	_, _, ok = flags.lookup(k)
	assert.False(t, ok)
}
