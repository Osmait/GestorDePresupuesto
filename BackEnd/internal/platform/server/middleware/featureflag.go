package middleware

import (
	"database/sql"

	"github.com/gin-gonic/gin"
	apperrors "github.com/osmait/gestorDePresupuesto/internal/platform/errors"
)

func IsFeatureEnabled(ctx *gin.Context, db *sql.DB, userID string, featureKey string) (bool, error) {
	var enabled bool
	err := db.QueryRowContext(
		ctx.Request.Context(),
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

	if err == sql.ErrNoRows {
		return false, nil
	}
	if err != nil {
		return false, err
	}

	return enabled, nil
}

// RequirePublicFeature gates a route behind a feature flag without requiring
// an authenticated user. Useful for endpoints that run before authentication
// (e.g. the WebAuthn login ceremony) where per-user overrides are not
// applicable. It evaluates the global override, falling back to default_enabled.
func RequirePublicFeature(db *sql.DB, featureKey string) gin.HandlerFunc {
	return func(c *gin.Context) {
		var enabled bool
		err := db.QueryRowContext(
			c.Request.Context(),
			`SELECT COALESCE(g.enabled, f.default_enabled)
			 FROM feature_flags f
			 LEFT JOIN feature_flag_global_overrides g ON g.feature_key = f.key
			 WHERE f.key = $1`,
			featureKey,
		).Scan(&enabled)
		if err == sql.ErrNoRows {
			_ = c.Error(apperrors.NewForbiddenError("feature disabled: " + featureKey))
			c.Abort()
			return
		}
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

func RequireFeature(db *sql.DB, featureKey string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetString("X-User-Id")
		if userID == "" {
			_ = c.Error(apperrors.NewUnauthorizedError("user_id missing from context"))
			c.Abort()
			return
		}

		enabled, err := IsFeatureEnabled(c, db, userID, featureKey)
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
