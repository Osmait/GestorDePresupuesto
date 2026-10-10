package middleware

import (
	"context"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const flagQuery = `SELECT COALESCE\(g.enabled, o.enabled, f.default_enabled\)`

func TestFeatureFlags_CachesAndInvalidates(t *testing.T) {
	db, mock, err := sqlmock.New()
	require.NoError(t, err)
	defer func() { _ = db.Close() }()

	now := time.Unix(1_700_000_000, 0)
	flags := NewFeatureFlags(db, 30*time.Second)
	flags.now = func() time.Time { return now }
	ctx := context.Background()

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
	for i := 0; i < 2; i++ {
		mock.ExpectQuery(flagQuery).WithArgs("u1", "module_loans").
			WillReturnRows(sqlmock.NewRows([]string{"enabled"}).AddRow(true))
		enabled, err := flags.Enabled(context.Background(), "u1", "module_loans")
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
