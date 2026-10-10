package middleware

import (
	"context"
	"database/sql"
	"errors"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	apperrors "github.com/osmait/gestorDePresupuesto/internal/platform/errors"
	"github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/txhelper"
)

// DefaultFeatureFlagCacheTTL is used when FEATURE_FLAG_CACHE_TTL is unset.
const DefaultFeatureFlagCacheTTL = 30 * time.Second

// maxFeatureFlagCacheEntries bounds memory: when exceeded the cache is reset.
const maxFeatureFlagCacheEntries = 10000

// FeatureFlags evaluates feature flags for route gating.
//
// Queries run on the request's RLS transaction (txhelper.FromContext): the
// gate runs after RLSMiddleware, which already holds this request's pooled
// connection, so querying the *sql.DB here would need a second connection and
// deadlock under load once every connection belongs to a request waiting in
// this gate. Running inside the transaction also makes per-user overrides
// visible under FORCE ROW LEVEL SECURITY (app.current_user_id is set).
//
// Results are cached in memory per (user, feature) for ttl so the gate does
// not hit the database on every request. Correctness never depends on the
// cache: a miss always queries. Admin updates call Invalidate (immediately and
// again after their transaction ends, see txhelper.AfterTx); other instances
// converge within ttl. ttl <= 0 disables caching.
type FeatureFlags struct {
	db  *sql.DB
	ttl time.Duration
	now func() time.Time

	mu         sync.Mutex
	generation uint64
	entries    map[featureCacheKey]featureCacheEntry
}

type featureCacheKey struct {
	userID string // "" for the public (global) evaluation
	key    string
	public bool
}

type featureCacheEntry struct {
	enabled bool
	expires time.Time
}

// NewFeatureFlags returns a feature-flag evaluator backed by db.
func NewFeatureFlags(db *sql.DB, ttl time.Duration) *FeatureFlags {
	return &FeatureFlags{db: db, ttl: ttl, now: time.Now, entries: make(map[featureCacheKey]featureCacheEntry)}
}

// Invalidate drops every cached evaluation. Call it whenever flags or
// overrides change.
func (f *FeatureFlags) Invalidate() {
	if f == nil {
		return
	}
	f.mu.Lock()
	f.generation++
	f.entries = make(map[featureCacheKey]featureCacheEntry)
	f.mu.Unlock()
}

// InvalidateAfterTx invalidates now and again once the request transaction
// carried by ctx has finished, so a request that read the old value between
// the write and the commit cannot keep it cached for a whole TTL.
func (f *FeatureFlags) InvalidateAfterTx(ctx context.Context) {
	if f == nil {
		return
	}
	f.Invalidate()
	txhelper.AfterTx(ctx, f.Invalidate)
}

func (f *FeatureFlags) lookup(k featureCacheKey) (bool, uint64, bool) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.ttl > 0 {
		if e, ok := f.entries[k]; ok && f.now().Before(e.expires) {
			return e.enabled, f.generation, true
		}
	}
	return false, f.generation, false
}

func (f *FeatureFlags) store(k featureCacheKey, enabled bool, generation uint64) {
	if f.ttl <= 0 {
		return
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	if generation != f.generation {
		return // invalidated while we were querying: the value may be stale
	}
	if len(f.entries) >= maxFeatureFlagCacheEntries {
		f.entries = make(map[featureCacheKey]featureCacheEntry)
	}
	f.entries[k] = featureCacheEntry{enabled: enabled, expires: f.now().Add(f.ttl)}
}

// Enabled reports whether featureKey is enabled for userID: the global
// override wins, then the user's override, then the flag's default. Unknown
// flags are disabled.
func (f *FeatureFlags) Enabled(ctx context.Context, userID, featureKey string) (bool, error) {
	k := featureCacheKey{userID: userID, key: featureKey}
	cached, generation, ok := f.lookup(k)
	if ok {
		return cached, nil
	}

	var enabled bool
	err := txhelper.FromContext(ctx, f.db).QueryRowContext(
		ctx,
		`SELECT COALESCE(g.enabled, o.enabled, f.default_enabled)
		 FROM feature_flags f
		 LEFT JOIN feature_flag_global_overrides g
		   ON g.feature_key = f.key
		 LEFT JOIN feature_flag_user_overrides o
		   ON o.feature_key = f.key AND o.user_id = $1
		 WHERE f.key = $2`,
		userID,
		featureKey,
	).Scan(&enabled)
	if errors.Is(err, sql.ErrNoRows) {
		enabled, err = false, nil
	}
	if err != nil {
		return false, err
	}
	f.store(k, enabled, generation)
	return enabled, nil
}

// PublicEnabled evaluates featureKey without a user: the global override,
// falling back to default_enabled. Unknown flags are disabled.
func (f *FeatureFlags) PublicEnabled(ctx context.Context, featureKey string) (bool, error) {
	k := featureCacheKey{key: featureKey, public: true}
	cached, generation, ok := f.lookup(k)
	if ok {
		return cached, nil
	}

	var enabled bool
	err := txhelper.FromContext(ctx, f.db).QueryRowContext(
		ctx,
		`SELECT COALESCE(g.enabled, f.default_enabled)
		 FROM feature_flags f
		 LEFT JOIN feature_flag_global_overrides g ON g.feature_key = f.key
		 WHERE f.key = $1`,
		featureKey,
	).Scan(&enabled)
	if errors.Is(err, sql.ErrNoRows) {
		enabled, err = false, nil
	}
	if err != nil {
		return false, err
	}
	f.store(k, enabled, generation)
	return enabled, nil
}

// RequirePublic gates a route behind a feature flag without requiring an
// authenticated user. Useful for endpoints that run before authentication
// (e.g. the WebAuthn login ceremony) where per-user overrides are not
// applicable. It evaluates the global override, falling back to default_enabled.
func (f *FeatureFlags) RequirePublic(featureKey string) gin.HandlerFunc {
	return func(c *gin.Context) {
		enabled, err := f.PublicEnabled(c.Request.Context(), featureKey)
		if err != nil {
			_ = c.Error(apperrors.NewInternalError("failed to evaluate feature flag", err))
			c.Abort()
			return
		}
		if !enabled {
			_ = c.Error(apperrors.NewForbiddenError("feature disabled: " + featureKey))
			c.Abort()
			return
		}
		c.Next()
	}
}

// Require gates a route behind a feature flag for the authenticated user.
func (f *FeatureFlags) Require(featureKey string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetString("X-User-Id")
		if userID == "" {
			_ = c.Error(apperrors.NewUnauthorizedError("user_id missing from context"))
			c.Abort()
			return
		}

		enabled, err := f.Enabled(c.Request.Context(), userID, featureKey)
		if err != nil {
			_ = c.Error(apperrors.NewInternalError("failed to evaluate feature flag", err))
			c.Abort()
			return
		}

		if !enabled {
			_ = c.Error(apperrors.NewForbiddenError("feature disabled: " + featureKey))
			c.Abort()
			return
		}

		c.Next()
	}
}
