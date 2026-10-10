package postgress

import (
	"context"
	"errors"
	"strings"

	"github.com/lib/pq"
	"github.com/osmait/gestorDePresupuesto/internal/domain/category"
	"github.com/osmait/gestorDePresupuesto/internal/platform/i18n"
	txhelper "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/txhelper"
	"github.com/rs/zerolog/log"
)

// EnsureSystemCategory returns the id of userId's system category `sys`,
// creating it (named in the request's locale) when missing.
func (c *CategoryRespository) EnsureSystemCategory(ctx context.Context, userId string, sys category.System) (string, error) {
	return EnsureSystem(ctx, txhelper.FromContext(ctx, c.db), userId, sys)
}

// EnsureSystem finds or creates userId's system category `sys` with q.
//
// The row is identified by its deterministic id (sys.ID), never by the
// localized name, so switching language never creates a duplicate. A row
// created before deterministic ids existed is adopted when its name is one of
// sys.KnownNames (a fixed, locale-independent set). Only a new row takes the
// name of the current locale. Concurrent first calls converge on one row.
func EnsureSystem(ctx context.Context, q txhelper.Querier, userId string, sys category.System) (string, error) {
	if userId == "" {
		return "", errors.New("system category requires a user id")
	}
	id := sys.ID(userId)
	known := make([]string, 0, len(sys.KnownNames))
	for _, n := range sys.KnownNames {
		known = append(known, strings.ToLower(strings.TrimSpace(n)))
	}
	name := i18n.T(ctx, i18n.CategoryKey(sys.Key))

	query := `
		WITH existing AS (
			SELECT id FROM categorys
			WHERE user_id = $1 AND (id = $2 OR LOWER(TRIM(name)) = ANY($3::text[]))
			ORDER BY (id = $2) DESC, created_at ASC
			LIMIT 1
		), ins AS (
			INSERT INTO categorys (id, name, icon, color, created_at, user_id)
			SELECT $2, $4, $5, $6, NOW(), $1
			WHERE NOT EXISTS (SELECT 1 FROM existing)
			ON CONFLICT (id) DO NOTHING
			RETURNING id
		)
		SELECT COALESCE((SELECT id FROM existing), (SELECT id FROM ins), $2::varchar)`
	var found string
	if err := q.QueryRowContext(ctx, query, userId, id, pq.Array(known), name, sys.Icon, sys.Color).Scan(&found); err != nil {
		log.Error().Err(err).Str("user_id", userId).Str("system_category", sys.Key).Msg("Failed to ensure system category")
		return "", err
	}
	return found, nil
}
