package featureflag

import (
	"context"
	"database/sql"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	apperrors "github.com/osmait/gestorDePresupuesto/internal/platform/errors"
	"github.com/osmait/gestorDePresupuesto/internal/platform/server/middleware"
	"github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/txhelper"
	"github.com/segmentio/ksuid"
)

// Handler serves the feature-flag endpoints. Every query runs on the
// request's RLS transaction (txhelper.FromContext / txhelper.InTx): these
// routes are registered after RLSMiddleware, which already holds the
// request's pooled connection, so using the *sql.DB directly would need a
// second connection (pool deadlock under load).
type Handler struct {
	db    *sql.DB
	flags *middleware.FeatureFlags
}

// NewHandler returns a Handler. flags (may be nil) is the route-gate cache
// that admin updates invalidate.
func NewHandler(db *sql.DB, flags *middleware.FeatureFlags) *Handler {
	return &Handler{db: db, flags: flags}
}

// errUnknownFeature marks a request for a feature key that does not exist.
var errUnknownFeature = errors.New("unknown feature key")

type FeatureItem struct {
	Key                 string `json:"key"`
	Name                string `json:"name"`
	Description         string `json:"description"`
	Scope               string `json:"scope"`
	DefaultEnabled      bool   `json:"default_enabled"`
	Enabled             bool   `json:"enabled"`
	HasOverride         bool   `json:"has_override"`
	HasGlobalOverride   bool   `json:"has_global_override"`
	GlobalEnabled       *bool  `json:"global_enabled,omitempty"`
	UserOverrideEnabled *bool  `json:"user_override_enabled,omitempty"`
	Source              string `json:"source"`
	BlockedByGlobal     bool   `json:"blocked_by_global"`
}

type FeatureResponse struct {
	Success bool                   `json:"success"`
	Data    []FeatureItem          `json:"data"`
	Map     map[string]bool        `json:"map,omitempty"`
	Meta    map[string]interface{} `json:"meta,omitempty"`
}

type FeatureOverride struct {
	FeatureKey string `json:"feature_key" binding:"required"`
	Enabled    bool   `json:"enabled"`
	Reason     string `json:"reason"`
}

type FeatureOverrideRequest struct {
	Overrides []FeatureOverride `json:"overrides" binding:"required,min=1,dive"`
}

type GlobalOverrideRequest struct {
	Enabled bool   `json:"enabled"`
	Reason  string `json:"reason"`
}

func (h *Handler) GetMyFeatures(c *gin.Context) {
	userID := c.GetString("X-User-Id")
	features, err := h.getFeaturesForUser(c.Request.Context(), userID)
	if err != nil {
		_ = c.Error(apperrors.NewInternalError("failed to load feature flags", err))
		return
	}

	effective := make(map[string]bool, len(features))
	for _, item := range features {
		effective[item.Key] = item.Enabled
	}

	c.JSON(http.StatusOK, FeatureResponse{Success: true, Data: features, Map: effective})
}

func (h *Handler) GetCatalog(c *gin.Context) {
	rows, err := txhelper.FromContext(c.Request.Context(), h.db).QueryContext(
		c.Request.Context(),
		`SELECT f.key, f.name, COALESCE(f.description, ''), f.scope, f.default_enabled,
		        g.enabled,
		        (g.feature_key IS NOT NULL) AS has_global_override,
		        COALESCE(g.enabled, f.default_enabled) AS effective_enabled
		 FROM feature_flags f
		 LEFT JOIN feature_flag_global_overrides g
		   ON g.feature_key = f.key
		 ORDER BY key ASC`,
	)
	if err != nil {
		_ = c.Error(apperrors.NewInternalError("failed to load feature catalog", err))
		return
	}
	defer func() { _ = rows.Close() }()

	result := make([]FeatureItem, 0)
	for rows.Next() {
		item := FeatureItem{}
		var globalEnabled sql.NullBool
		if scanErr := rows.Scan(&item.Key, &item.Name, &item.Description, &item.Scope, &item.DefaultEnabled, &globalEnabled, &item.HasGlobalOverride, &item.Enabled); scanErr != nil {
			_ = c.Error(apperrors.NewInternalError("failed to parse feature catalog", scanErr))
			return
		}
		if globalEnabled.Valid {
			value := globalEnabled.Bool
			item.GlobalEnabled = &value
		}
		item.HasOverride = false
		item.Source = map[bool]string{true: "global", false: "default"}[item.HasGlobalOverride]
		item.BlockedByGlobal = false
		result = append(result, item)
	}

	c.JSON(http.StatusOK, FeatureResponse{Success: true, Data: result})
}

func (h *Handler) GetUserFeatures(c *gin.Context) {
	userID := c.Param("id")
	features, err := h.getFeaturesForUser(c.Request.Context(), userID)
	if err != nil {
		_ = c.Error(apperrors.NewInternalError("failed to load user feature flags", err))
		return
	}

	c.JSON(http.StatusOK, FeatureResponse{Success: true, Data: features, Meta: map[string]interface{}{"user_id": userID}})
}

func (h *Handler) SetGlobalFeature(c *gin.Context) {
	adminID := c.GetString("X-User-Id")
	featureKey := c.Param("featureKey")

	var req GlobalOverrideRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		_ = c.Error(apperrors.NewValidationError("INVALID_REQUEST", "Invalid request body: "+err.Error()))
		return
	}

	ctx := c.Request.Context()
	err := txhelper.InTx(ctx, h.db, func(q txhelper.Querier) error {
		oldValue, hasOld, err := h.getGlobalFeatureEffective(ctx, q, featureKey)
		if err != nil {
			return err
		}
		if _, err = q.ExecContext(
			ctx,
			`INSERT INTO feature_flag_global_overrides (feature_key, enabled, updated_by_admin_id, updated_at)
			 VALUES ($1, $2, $3, $4)
			 ON CONFLICT (feature_key)
			 DO UPDATE SET enabled = EXCLUDED.enabled, updated_by_admin_id = EXCLUDED.updated_by_admin_id, updated_at = EXCLUDED.updated_at`,
			featureKey,
			req.Enabled,
			adminID,
			time.Now(),
		); err != nil {
			return err
		}
		if !hasOld {
			oldValue = false
		}
		return h.insertAuditLog(ctx, q, "global", nil, featureKey, &oldValue, &req.Enabled, adminID, req.Reason)
	})
	h.flags.InvalidateAfterTx(ctx)
	if err != nil {
		_ = c.Error(apperrors.NewInternalError("failed to set global feature override", err))
		return
	}

	h.GetCatalog(c)
}

func (h *Handler) ResetGlobalFeature(c *gin.Context) {
	adminID := c.GetString("X-User-Id")
	featureKey := c.Param("featureKey")

	ctx := c.Request.Context()
	err := txhelper.InTx(ctx, h.db, func(q txhelper.Querier) error {
		oldValue, hasOld, err := h.getGlobalFeatureEffective(ctx, q, featureKey)
		if err != nil {
			return err
		}
		if _, err = q.ExecContext(ctx, `DELETE FROM feature_flag_global_overrides WHERE feature_key = $1`, featureKey); err != nil {
			return err
		}
		newValue, hasNew, err := h.getGlobalFeatureEffective(ctx, q, featureKey)
		if err != nil {
			return err
		}
		if !hasNew {
			newValue = false
		}
		if !hasOld {
			return nil
		}
		return h.insertAuditLog(ctx, q, "global", nil, featureKey, &oldValue, &newValue, adminID, "reset global override")
	})
	h.flags.InvalidateAfterTx(ctx)
	if err != nil {
		_ = c.Error(apperrors.NewInternalError("failed resetting global override", err))
		return
	}

	h.GetCatalog(c)
}

func (h *Handler) UpsertUserFeatures(c *gin.Context) {
	adminID := c.GetString("X-User-Id")
	userID := c.Param("id")

	var req FeatureOverrideRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		_ = c.Error(apperrors.NewValidationError("INVALID_REQUEST", "Invalid request body: "+err.Error()))
		return
	}

	ctx := c.Request.Context()
	var unknownKey string
	err := txhelper.InTx(ctx, h.db, func(q txhelper.Querier) error {
		for _, override := range req.Overrides {
			featureKey := strings.TrimSpace(override.FeatureKey)
			if featureKey == "" {
				continue
			}

			var exists bool
			if err := q.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM feature_flags WHERE key = $1)`, featureKey).Scan(&exists); err != nil {
				return err
			}
			if !exists {
				unknownKey = featureKey
				return errUnknownFeature
			}

			oldValue, hasOld, err := h.getUserFeatureEffective(ctx, q, userID, featureKey)
			if err != nil {
				return err
			}

			if _, err = q.ExecContext(
				ctx,
				`INSERT INTO feature_flag_user_overrides (id, user_id, feature_key, enabled, updated_by_admin_id, updated_at)
				 VALUES ($1, $2, $3, $4, $5, $6)
				 ON CONFLICT (user_id, feature_key)
				 DO UPDATE SET enabled = EXCLUDED.enabled, updated_by_admin_id = EXCLUDED.updated_by_admin_id, updated_at = EXCLUDED.updated_at`,
				ksuid.New().String(),
				userID,
				featureKey,
				override.Enabled,
				adminID,
				time.Now(),
			); err != nil {
				return err
			}

			if !hasOld {
				oldValue = false
			}
			targetUserID := userID
			if err = h.insertAuditLog(ctx, q, "user", &targetUserID, featureKey, &oldValue, &override.Enabled, adminID, override.Reason); err != nil {
				return err
			}
		}
		return nil
	})
	h.flags.InvalidateAfterTx(ctx)
	if errors.Is(err, errUnknownFeature) {
		_ = c.Error(apperrors.NewValidationError("FEATURE_NOT_FOUND", "unknown feature key: "+unknownKey))
		return
	}
	if err != nil {
		_ = c.Error(apperrors.NewInternalError("failed to update feature override", err))
		return
	}

	features, err := h.getFeaturesForUser(c.Request.Context(), userID)
	if err != nil {
		_ = c.Error(apperrors.NewInternalError("failed to load updated user feature flags", err))
		return
	}

	c.JSON(http.StatusOK, FeatureResponse{Success: true, Data: features, Meta: map[string]interface{}{"user_id": userID}})
}

func (h *Handler) ResetUserFeature(c *gin.Context) {
	adminID := c.GetString("X-User-Id")
	userID := c.Param("id")
	featureKey := c.Param("featureKey")

	ctx := c.Request.Context()
	err := txhelper.InTx(ctx, h.db, func(q txhelper.Querier) error {
		oldValue, hasOld, err := h.getUserFeatureEffective(ctx, q, userID, featureKey)
		if err != nil {
			return err
		}
		if _, err = q.ExecContext(ctx, `DELETE FROM feature_flag_user_overrides WHERE user_id = $1 AND feature_key = $2`, userID, featureKey); err != nil {
			return err
		}
		newValue, _, err := h.getUserFeatureEffective(ctx, q, userID, featureKey)
		if err != nil {
			return err
		}
		if !hasOld {
			return nil
		}
		targetUserID := userID
		return h.insertAuditLog(ctx, q, "user", &targetUserID, featureKey, &oldValue, &newValue, adminID, "reset override")
	})
	h.flags.InvalidateAfterTx(ctx)
	if err != nil {
		_ = c.Error(apperrors.NewInternalError("failed to reset user override", err))
		return
	}

	features, err := h.getFeaturesForUser(c.Request.Context(), userID)
	if err != nil {
		_ = c.Error(apperrors.NewInternalError("failed to load updated user feature flags", err))
		return
	}

	c.JSON(http.StatusOK, FeatureResponse{Success: true, Data: features, Meta: map[string]interface{}{"user_id": userID}})
}

func (h *Handler) getFeaturesForUser(ctx context.Context, userID string) ([]FeatureItem, error) {
	rows, err := txhelper.FromContext(ctx, h.db).QueryContext(
		ctx,
		`SELECT f.key, f.name, COALESCE(f.description, ''), f.scope, f.default_enabled,
		        COALESCE(g.enabled, o.enabled, f.default_enabled) AS enabled,
		        (o.feature_key IS NOT NULL) AS has_override,
		        (g.feature_key IS NOT NULL) AS has_global_override,
		        o.enabled AS user_override_enabled,
		        g.enabled AS global_enabled,
		        CASE
		            WHEN g.feature_key IS NOT NULL THEN 'global'
		            WHEN o.feature_key IS NOT NULL THEN 'user'
		            ELSE 'default'
		        END AS source
		 FROM feature_flags f
		 LEFT JOIN feature_flag_global_overrides g
		   ON g.feature_key = f.key
		 LEFT JOIN feature_flag_user_overrides o
		   ON o.feature_key = f.key AND o.user_id = $1
		 ORDER BY f.key ASC`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	result := make([]FeatureItem, 0)
	for rows.Next() {
		item := FeatureItem{}
		var userOverride sql.NullBool
		var globalOverride sql.NullBool
		if scanErr := rows.Scan(
			&item.Key,
			&item.Name,
			&item.Description,
			&item.Scope,
			&item.DefaultEnabled,
			&item.Enabled,
			&item.HasOverride,
			&item.HasGlobalOverride,
			&userOverride,
			&globalOverride,
			&item.Source,
		); scanErr != nil {
			return nil, scanErr
		}
		if userOverride.Valid {
			value := userOverride.Bool
			item.UserOverrideEnabled = &value
		}
		if globalOverride.Valid {
			value := globalOverride.Bool
			item.GlobalEnabled = &value
		}
		item.BlockedByGlobal = item.HasGlobalOverride
		result = append(result, item)
	}

	return result, rows.Err()
}

func (h *Handler) getUserFeatureEffective(ctx context.Context, q txhelper.Querier, userID string, featureKey string) (bool, bool, error) {
	var enabled bool
	err := q.QueryRowContext(
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
	if err == sql.ErrNoRows {
		return false, false, nil
	}
	if err != nil {
		return false, false, err
	}
	return enabled, true, nil
}

func (h *Handler) getGlobalFeatureEffective(ctx context.Context, q txhelper.Querier, featureKey string) (bool, bool, error) {
	var enabled bool
	err := q.QueryRowContext(
		ctx,
		`SELECT COALESCE(g.enabled, f.default_enabled)
		 FROM feature_flags f
		 LEFT JOIN feature_flag_global_overrides g
		   ON g.feature_key = f.key
		 WHERE f.key = $1`,
		featureKey,
	).Scan(&enabled)
	if err == sql.ErrNoRows {
		return false, false, nil
	}
	if err != nil {
		return false, false, err
	}
	return enabled, true, nil
}

func (h *Handler) insertAuditLog(ctx context.Context, q txhelper.Querier, scope string, targetUserID *string, featureKey string, oldValue *bool, newValue *bool, adminID, reason string) error {
	auditID := ksuid.New().String()
	_, err := q.ExecContext(
		ctx,
		`INSERT INTO feature_flag_audit_logs
			(id, user_id, target_user_id, feature_key, old_value, new_value, changed_by_admin_id, reason, scope, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
		auditID,
		targetUserID,
		targetUserID,
		featureKey,
		oldValue,
		newValue,
		adminID,
		strings.TrimSpace(reason),
		scope,
		time.Now(),
	)
	return err
}
