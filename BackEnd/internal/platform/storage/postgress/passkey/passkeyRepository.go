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
		pq.Array(pk.Transports), pk.Name, jsonText(pk.CredentialJSON), pk.LastUsedAt, pk.CreatedAt,
	)
	if err != nil {
		log.Error().Err(err).Str("user_id", pk.UserId).Msg("Failed to save passkey")
	}
	return err
}

// jsonText passes JSON held in a []byte as text (NULL when empty). With
// binary_parameters=yes lib/pq sends every []byte argument in binary format,
// which is right for BYTEA columns but not for JSONB (its binary format starts
// with a version byte: "unsupported jsonb version number 123").
func jsonText(b []byte) any {
	if len(b) == 0 {
		return nil
	}
	return string(b)
}

// The passkey login ceremony (FinishLogin) runs before anyone is
// authenticated: FindByCredentialId, FindByUserId and UpdateSignCount then
// run in a system transaction (txhelper.WithAdminTx) so the passkeys policy
// lets them through under a role subject to row level security. Inside an
// authenticated request they run on the request transaction as before.

func (r *PasskeyRepository) FindByCredentialId(ctx context.Context, credentialId []byte) (*passkey.Passkey, error) {
	query := `SELECT id, user_id, credential_id, public_key, sign_count, COALESCE(aaguid, ''::bytea),
			COALESCE(transports, '{}'::text[]), name, COALESCE(credential_json::text, ''), last_used_at, created_at
		FROM passkeys WHERE credential_id = $1`
	var pk *passkey.Passkey
	err := txhelper.WithAdminTx(ctx, r.db, func(ctx context.Context) error {
		var scanErr error
		pk, scanErr = scanPasskey(txhelper.FromContext(ctx, r.db).QueryRowContext(ctx, query, credentialId))
		return scanErr
	})
	return pk, err
}

func (r *PasskeyRepository) FindByUserId(ctx context.Context, userId string) ([]*passkey.Passkey, error) {
	var passkeys []*passkey.Passkey
	err := txhelper.WithAdminTx(ctx, r.db, func(ctx context.Context) error {
		var err error
		passkeys, err = r.findByUserId(ctx, userId)
		return err
	})
	return passkeys, err
}

func (r *PasskeyRepository) findByUserId(ctx context.Context, userId string) ([]*passkey.Passkey, error) {
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

func (r *PasskeyRepository) UpdateSignCount(ctx context.Context, id string, signCount uint32, credentialJSON []byte) error {
	// credential_json is what toWebAuthnCredential prefers on the next login,
	// so it must carry the new counter/flags too — otherwise the stale JSON
	// counter would make every later login look like a cloned authenticator.
	var credJSON any
	if len(credentialJSON) > 0 {
		credJSON = string(credentialJSON)
	}
	query := `UPDATE passkeys
		SET sign_count = $1, last_used_at = $2, credential_json = COALESCE($3::jsonb, credential_json)
		WHERE id = $4`
	return txhelper.WithAdminTx(ctx, r.db, func(ctx context.Context) error {
		result, err := txhelper.FromContext(ctx, r.db).ExecContext(ctx, query, signCount, time.Now(), credJSON, id)
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
	})
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

// SaveSession stores a WebAuthn ceremony session. Expired rows are purged
// opportunistically.
//
// It runs on the request transaction when there is one (the authenticated
// registration ceremony runs after RLSMiddleware, which already holds the
// request's pooled connection: using the pool here would need a second
// connection and deadlock under load). The response is only sent after that
// transaction commits, so the session is visible to every instance before
// the client can use it. The anonymous login ceremony has no request
// transaction and autocommits on the pool.
func (r *PasskeyRepository) SaveSession(ctx context.Context, session *WebAuthnSession) error {
	if _, err := txhelper.FromContext(ctx, r.db).ExecContext(ctx, `DELETE FROM webauthn_sessions WHERE expires_at < NOW()`); err != nil {
		log.Warn().Err(err).Msg("failed to purge expired webauthn sessions")
	}
	var userID any
	if session.UserId != "" {
		userID = session.UserId
	}
	_, err := txhelper.FromContext(ctx, r.db).ExecContext(ctx, `INSERT INTO webauthn_sessions (id, kind, user_id, session_data, expires_at)
		VALUES ($1, $2, $3, $4::jsonb, $5)`,
		session.Id, session.Kind, userID, string(session.SessionData), session.ExpiresAt)
	return err
}

// TakeSession atomically consumes a session: the DELETE ... RETURNING makes
// it single-use even across instances.
//
// For the anonymous login ceremony there is no request transaction, so the
// DELETE autocommits and the session stays consumed whatever the outcome.
// The authenticated registration ceremony runs inside the request
// transaction (never a second pooled connection): if registration fails the
// request rolls back and the session remains usable until it expires
// (WEBAUTHN_CHALLENGE_TTL), but only by the same authenticated user, whose id
// is bound to the session and re-checked by FinishRegistration. Concurrent
// consumers are still serialised by the row lock.
func (r *PasskeyRepository) TakeSession(ctx context.Context, id, kind string) (*WebAuthnSession, error) {
	s := &WebAuthnSession{}
	var userID sql.NullString
	var data string
	err := txhelper.FromContext(ctx, r.db).QueryRowContext(ctx, `DELETE FROM webauthn_sessions
		WHERE id = $1 AND kind = $2
		RETURNING id, kind, user_id, session_data::text, expires_at`, id, kind).
		Scan(&s.Id, &s.Kind, &userID, &data, &s.ExpiresAt)
	if err != nil {
		return nil, err
	}
	if !s.ExpiresAt.After(time.Now()) {
		return nil, sql.ErrNoRows
	}
	s.UserId = userID.String
	s.SessionData = []byte(data)
	return s, nil
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
