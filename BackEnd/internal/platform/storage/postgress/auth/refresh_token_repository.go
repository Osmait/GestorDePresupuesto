package auth

import (
	"context"
	"database/sql"
	"time"

	authDomain "github.com/osmait/gestorDePresupuesto/internal/domain/auth"
)

// RefreshTokenRepositoryInterface defines the contract for refresh token storage
type RefreshTokenRepositoryInterface interface {
	Save(ctx context.Context, token *authDomain.RefreshToken) error
	FindByHash(ctx context.Context, tokenHash string) (*authDomain.RefreshToken, error)
	FindByUserId(ctx context.Context, userId string) ([]*authDomain.RefreshToken, error)
	Revoke(ctx context.Context, tokenId string, replacedBy *string) error
	RevokeByHash(ctx context.Context, tokenHash string) error
	RevokeAllForUser(ctx context.Context, userId string) error
	DeleteExpired(ctx context.Context) (int64, error)
}

// RefreshTokenRepository implements RefreshTokenRepositoryInterface with PostgreSQL
type RefreshTokenRepository struct {
	db *sql.DB
}

// NewRefreshTokenRepository creates a new RefreshTokenRepository
func NewRefreshTokenRepository(db *sql.DB) *RefreshTokenRepository {
	return &RefreshTokenRepository{db: db}
}

// Save stores a new refresh token in the database
func (r *RefreshTokenRepository) Save(ctx context.Context, token *authDomain.RefreshToken) error {
	query := `
		INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, created_at, user_agent, ip_address)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`
	_, err := r.db.ExecContext(ctx, query,
		token.Id,
		token.UserId,
		token.TokenHash,
		token.ExpiresAt,
		token.CreatedAt,
		token.UserAgent,
		token.IpAddress,
	)
	return err
}

// FindByHash retrieves a refresh token by its hash
func (r *RefreshTokenRepository) FindByHash(ctx context.Context, tokenHash string) (*authDomain.RefreshToken, error) {
	query := `
		SELECT id, user_id, token_hash, expires_at, created_at, revoked_at, replaced_by, user_agent, ip_address
		FROM refresh_tokens
		WHERE token_hash = $1
	`
	row := r.db.QueryRowContext(ctx, query, tokenHash)

	var token authDomain.RefreshToken
	var revokedAt sql.NullTime
	var replacedBy sql.NullString
	var userAgent, ipAddress sql.NullString

	err := row.Scan(
		&token.Id,
		&token.UserId,
		&token.TokenHash,
		&token.ExpiresAt,
		&token.CreatedAt,
		&revokedAt,
		&replacedBy,
		&userAgent,
		&ipAddress,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}

	if revokedAt.Valid {
		token.RevokedAt = &revokedAt.Time
	}
	if replacedBy.Valid {
		token.ReplacedBy = &replacedBy.String
	}
	if userAgent.Valid {
		token.UserAgent = userAgent.String
	}
	if ipAddress.Valid {
		token.IpAddress = ipAddress.String
	}

	return &token, nil
}

// FindByUserId retrieves all active refresh tokens for a user
func (r *RefreshTokenRepository) FindByUserId(ctx context.Context, userId string) ([]*authDomain.RefreshToken, error) {
	query := `
		SELECT id, user_id, token_hash, expires_at, created_at, revoked_at, replaced_by, user_agent, ip_address
		FROM refresh_tokens
		WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > NOW()
		ORDER BY created_at DESC
	`
	rows, err := r.db.QueryContext(ctx, query, userId)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tokens []*authDomain.RefreshToken
	for rows.Next() {
		var token authDomain.RefreshToken
		var revokedAt sql.NullTime
		var replacedBy sql.NullString
		var userAgent, ipAddress sql.NullString

		err := rows.Scan(
			&token.Id,
			&token.UserId,
			&token.TokenHash,
			&token.ExpiresAt,
			&token.CreatedAt,
			&revokedAt,
			&replacedBy,
			&userAgent,
			&ipAddress,
		)
		if err != nil {
			return nil, err
		}

		if revokedAt.Valid {
			token.RevokedAt = &revokedAt.Time
		}
		if replacedBy.Valid {
			token.ReplacedBy = &replacedBy.String
		}
		if userAgent.Valid {
			token.UserAgent = userAgent.String
		}
		if ipAddress.Valid {
			token.IpAddress = ipAddress.String
		}

		tokens = append(tokens, &token)
	}

	return tokens, rows.Err()
}

// Revoke marks a refresh token as revoked
func (r *RefreshTokenRepository) Revoke(ctx context.Context, tokenId string, replacedBy *string) error {
	query := `
		UPDATE refresh_tokens
		SET revoked_at = $1, replaced_by = $2
		WHERE id = $3 AND revoked_at IS NULL
	`
	now := time.Now()
	_, err := r.db.ExecContext(ctx, query, now, replacedBy, tokenId)
	return err
}

// RevokeByHash revokes a token by its hash (used for logout)
func (r *RefreshTokenRepository) RevokeByHash(ctx context.Context, tokenHash string) error {
	query := `
		UPDATE refresh_tokens
		SET revoked_at = $1
		WHERE token_hash = $2 AND revoked_at IS NULL
	`
	_, err := r.db.ExecContext(ctx, query, time.Now(), tokenHash)
	return err
}

// RevokeAllForUser revokes all refresh tokens for a user (logout from all devices)
func (r *RefreshTokenRepository) RevokeAllForUser(ctx context.Context, userId string) error {
	query := `
		UPDATE refresh_tokens
		SET revoked_at = $1
		WHERE user_id = $2 AND revoked_at IS NULL
	`
	_, err := r.db.ExecContext(ctx, query, time.Now(), userId)
	return err
}

// DeleteExpired removes expired tokens from the database (cleanup job)
func (r *RefreshTokenRepository) DeleteExpired(ctx context.Context) (int64, error) {
	query := `
		DELETE FROM refresh_tokens
		WHERE expires_at < NOW() - INTERVAL '7 days'
	`
	result, err := r.db.ExecContext(ctx, query)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected()
}
