package postgress

import (
	"context"
	"database/sql"
	"time"

	"github.com/google/uuid"
	"github.com/osmait/gestorDePresupuesto/internal/domain/apikey"
	txhelper "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/txhelper"
	"github.com/rs/zerolog/log"
)

// APIKeyRepositoryInterface defines the data-access contract for API keys.
type APIKeyRepositoryInterface interface {
	Save(ctx context.Context, key *apikey.APIKey) error
	FindByKeyHash(ctx context.Context, keyHash string) (*apikey.APIKey, error)
	FindByUserID(ctx context.Context, userID string) ([]*apikey.APIKey, error)
	FindByID(ctx context.Context, id string) (*apikey.APIKey, error)
	UpdateLastUsed(ctx context.Context, id string) error
	Delete(ctx context.Context, id, userID string) error
}

type APIKeyRepository struct {
	db *sql.DB
}

func NewAPIKeyRepository(db *sql.DB) *APIKeyRepository {
	return &APIKeyRepository{db: db}
}

func (r *APIKeyRepository) Save(ctx context.Context, key *apikey.APIKey) error {
	if key.ID == "" {
		key.ID = uuid.New().String()
	}
	_, err := txhelper.FromContext(ctx, r.db).ExecContext(ctx,
		`INSERT INTO user_api_keys (id, user_id, name, key_hash, key_prefix, expires_at, is_active)
		 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		key.ID, key.UserID, key.Name, key.KeyHash, key.KeyPrefix, key.ExpiresAt, key.IsActive,
	)
	return err
}

func (r *APIKeyRepository) FindByKeyHash(ctx context.Context, keyHash string) (*apikey.APIKey, error) {
	row := txhelper.FromContext(ctx, r.db).QueryRowContext(ctx,
		`SELECT id, user_id, name, key_hash, key_prefix, last_used_at, expires_at, created_at, is_active
		 FROM user_api_keys WHERE key_hash = $1`,
		keyHash,
	)
	return scanAPIKey(row)
}

func (r *APIKeyRepository) FindByUserID(ctx context.Context, userID string) ([]*apikey.APIKey, error) {
	rows, err := txhelper.FromContext(ctx, r.db).QueryContext(ctx,
		`SELECT id, user_id, name, key_hash, key_prefix, last_used_at, expires_at, created_at, is_active
		 FROM user_api_keys WHERE user_id = $1 ORDER BY created_at DESC`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer func() {
		if cerr := rows.Close(); cerr != nil {
			log.Error().Err(cerr).Msg("failed to close api key rows")
		}
	}()

	keys := make([]*apikey.APIKey, 0)
	for rows.Next() {
		k := &apikey.APIKey{}
		if err = rows.Scan(
			&k.ID, &k.UserID, &k.Name, &k.KeyHash, &k.KeyPrefix,
			&k.LastUsedAt, &k.ExpiresAt, &k.CreatedAt, &k.IsActive,
		); err == nil {
			keys = append(keys, k)
		}
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}
	return keys, nil
}

func (r *APIKeyRepository) FindByID(ctx context.Context, id string) (*apikey.APIKey, error) {
	row := txhelper.FromContext(ctx, r.db).QueryRowContext(ctx,
		`SELECT id, user_id, name, key_hash, key_prefix, last_used_at, expires_at, created_at, is_active
		 FROM user_api_keys WHERE id = $1`,
		id,
	)
	return scanAPIKey(row)
}

func (r *APIKeyRepository) UpdateLastUsed(ctx context.Context, id string) error {
	now := time.Now()
	_, err := txhelper.FromContext(ctx, r.db).ExecContext(ctx,
		`UPDATE user_api_keys SET last_used_at = $1 WHERE id = $2`,
		now, id,
	)
	return err
}

func (r *APIKeyRepository) Delete(ctx context.Context, id, userID string) error {
	result, err := txhelper.FromContext(ctx, r.db).ExecContext(ctx,
		`DELETE FROM user_api_keys WHERE id = $1 AND user_id = $2`,
		id, userID,
	)
	if err != nil {
		return err
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// scanAPIKey scans a single row into an APIKey struct.
func scanAPIKey(row *sql.Row) (*apikey.APIKey, error) {
	k := &apikey.APIKey{}
	err := row.Scan(
		&k.ID, &k.UserID, &k.Name, &k.KeyHash, &k.KeyPrefix,
		&k.LastUsedAt, &k.ExpiresAt, &k.CreatedAt, &k.IsActive,
	)
	if err != nil {
		return nil, err
	}
	return k, nil
}
