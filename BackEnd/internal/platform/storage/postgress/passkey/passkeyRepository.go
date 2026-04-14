package postgress

import (
	"context"
	"database/sql"
	"time"

	"github.com/lib/pq"
	"github.com/osmait/gestorDePresupuesto/internal/domain/passkey"
	txhelper "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/txhelper"
	"github.com/rs/zerolog/log"
)

type PasskeyRepository struct {
	db *sql.DB
}

func NewPasskeyRepository(db *sql.DB) *PasskeyRepository {
	return &PasskeyRepository{db: db}
}

func (r *PasskeyRepository) Save(ctx context.Context, pk *passkey.Passkey) error {
	query := `INSERT INTO passkeys
		(id, user_id, credential_id, public_key, sign_count, aaguid, transports, name, credential_json, last_used_at, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`
	_, err := txhelper.FromContext(ctx, r.db).ExecContext(ctx, query,
		pk.Id, pk.UserId, pk.CredentialId, pk.PublicKey, pk.SignCount, pk.AAGUID,
		pq.Array(pk.Transports), pk.Name, pk.CredentialJSON, pk.LastUsedAt, pk.CreatedAt,
	)
	if err != nil {
		log.Error().Err(err).Str("user_id", pk.UserId).Msg("Failed to save passkey")
	}
	return err
}

func (r *PasskeyRepository) FindByCredentialId(ctx context.Context, credentialId []byte) (*passkey.Passkey, error) {
	query := `SELECT id, user_id, credential_id, public_key, sign_count, COALESCE(aaguid, ''::bytea),
			COALESCE(transports, '{}'::text[]), name, COALESCE(credential_json::text, ''), last_used_at, created_at
		FROM passkeys WHERE credential_id = $1`
	row := txhelper.FromContext(ctx, r.db).QueryRowContext(ctx, query, credentialId)
	return scanPasskey(row)
}

func (r *PasskeyRepository) FindByUserId(ctx context.Context, userId string) ([]*passkey.Passkey, error) {
	query := `SELECT id, user_id, credential_id, public_key, sign_count, COALESCE(aaguid, ''::bytea),
			COALESCE(transports, '{}'::text[]), name, COALESCE(credential_json::text, ''), last_used_at, created_at
		FROM passkeys WHERE user_id = $1 ORDER BY created_at DESC`
	rows, err := txhelper.FromContext(ctx, r.db).QueryContext(ctx, query, userId)
	if err != nil {
		return nil, err
	}
	defer func() {
		if err = rows.Close(); err != nil {
			log.Error().Err(err).Msg("failed to close database rows")
		}
	}()

	var passkeys []*passkey.Passkey
	for rows.Next() {
		pk, scanErr := scanPasskeyRows(rows)
		if scanErr == nil {
			passkeys = append(passkeys, pk)
		}
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}
	return passkeys, nil
}

func (r *PasskeyRepository) UpdateSignCount(ctx context.Context, id string, signCount uint32) error {
	query := `UPDATE passkeys SET sign_count = $1, last_used_at = $2 WHERE id = $3`
	result, err := txhelper.FromContext(ctx, r.db).ExecContext(ctx, query, signCount, time.Now(), id)
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

func (r *PasskeyRepository) Delete(ctx context.Context, id string, userId string) error {
	query := `DELETE FROM passkeys WHERE id = $1 AND user_id = $2`
	result, err := txhelper.FromContext(ctx, r.db).ExecContext(ctx, query, id, userId)
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

type scannable interface {
	Scan(dest ...any) error
}

func scanPasskey(row scannable) (*passkey.Passkey, error) {
	pk := &passkey.Passkey{}
	var transports pq.StringArray
	var credentialJSON string
	var lastUsedAt sql.NullTime
	if err := row.Scan(&pk.Id, &pk.UserId, &pk.CredentialId, &pk.PublicKey, &pk.SignCount,
		&pk.AAGUID, &transports, &pk.Name, &credentialJSON, &lastUsedAt, &pk.CreatedAt); err != nil {
		return nil, err
	}
	pk.Transports = []string(transports)
	if credentialJSON != "" {
		pk.CredentialJSON = []byte(credentialJSON)
	}
	if lastUsedAt.Valid {
		t := lastUsedAt.Time
		pk.LastUsedAt = &t
	}
	return pk, nil
}

func scanPasskeyRows(rows *sql.Rows) (*passkey.Passkey, error) {
	return scanPasskey(rows)
}
