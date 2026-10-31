package postgress

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/likepattern"

	"github.com/rs/zerolog/log"

	domainUser "github.com/osmait/gestorDePresupuesto/internal/domain/user"
	"github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/txhelper"
	"github.com/osmait/gestorDePresupuesto/internal/services/errorhttp"
)

// UserRepository persists users. Every query resolves its executor through
// txhelper.FromContext: inside an HTTP request it runs on the request's RLS
// transaction (the request already holds that pooled connection, so using
// the pool here would need a second one and deadlock under load); outside a
// request (auth middleware, login, workers) it uses the pool.
type UserRepository struct {
	db *sql.DB
}

func NewUserRepository(db *sql.DB) *UserRepository {
	return &UserRepository{db: db}
}

// DeleteDemoUsersOlderThan deletes all demo users created before the specified time
func (u *UserRepository) DeleteDemoUsersOlderThan(ctx context.Context, olderThan time.Time) error {
	// WithAdminTx reuses the request transaction when called from an HTTP
	// handler (DELETE /users/demos, admin only) instead of opening a second
	// pooled connection while the request already holds one; the cleanup
	// worker gets its own transaction with app.is_admin = true, without which
	// a role subject to row level security would delete nothing.
	return txhelper.WithAdminTx(ctx, u.db, func(ctx context.Context) error {
		tx := txhelper.FromContext(ctx, u.db)
		var err error

		// 1. Delete transactions
		_, err = tx.ExecContext(ctx, `
		DELETE FROM transactions 
		WHERE user_id IN (
			SELECT id FROM users WHERE is_demo = true AND created_at < $1
		)`, olderThan)
		if err != nil {
			return err
		}

		// 2. Delete recurring transactions
		_, err = tx.ExecContext(ctx, `
		DELETE FROM recurring_transactions 
		WHERE user_id IN (
			SELECT id FROM users WHERE is_demo = true AND created_at < $1
		)`, olderThan)
		if err != nil {
			// Ignore if table does not exist
			if strings.Contains(err.Error(), "does not exist") || strings.Contains(err.Error(), "no such table") {
				log.Warn().Err(err).Msg("recurring_transactions table not found, skipping cleanup")
			} else {
				return err
			}
		}

		// 2.1 Delete notifications
		_, err = tx.ExecContext(ctx, `
		DELETE FROM notifications 
		WHERE user_id IN (
			SELECT id FROM users WHERE is_demo = true AND created_at < $1
		)`, olderThan)
		if err != nil {
			if strings.Contains(err.Error(), "does not exist") || strings.Contains(err.Error(), "no such table") {
				log.Warn().Err(err).Msg("notifications table not found, skipping cleanup")
			} else {
				return err
			}
		}

		// 3. Delete budgets
		_, err = tx.ExecContext(ctx, `
		DELETE FROM budgets 
		WHERE user_id IN (
			SELECT id FROM users WHERE is_demo = true AND created_at < $1
		)`, olderThan)
		if err != nil {
			return err
		}

		// 4. Delete investments
		_, err = tx.ExecContext(ctx, `
		DELETE FROM investments 
		WHERE user_id IN (
			SELECT id FROM users WHERE is_demo = true AND created_at < $1
		)`, olderThan)
		if err != nil {
			return err
		}

		// 5. Delete cryptos
		_, err = tx.ExecContext(ctx, `
		DELETE FROM cryptos 
		WHERE user_id IN (
			SELECT id FROM users WHERE is_demo = true AND created_at < $1
		)`, olderThan)
		if err != nil {
			return err
		}

		// 6. Delete accounts (must be after transactions)
		_, err = tx.ExecContext(ctx, `
		DELETE FROM account 
		WHERE user_id IN (
			SELECT id FROM users WHERE is_demo = true AND created_at < $1
		)`, olderThan)
		if err != nil {
			return err
		}

		// 7. Delete categories (must be after transactions/budgets)
		_, err = tx.ExecContext(ctx, `
		DELETE FROM categorys 
		WHERE user_id IN (
			SELECT id FROM users WHERE is_demo = true AND created_at < $1
		)`, olderThan)
		if err != nil {
			return err
		}

		// 8. Delete users
		_, err = tx.ExecContext(ctx, `
		DELETE FROM users 
		WHERE is_demo = true AND created_at < $1`, olderThan)
		if err != nil {
			return err
		}

		return nil
	})
}

// RevokeUserSessions revokes every refresh token of the user and deletes their
// MCP OAuth tokens and pending authorization codes, including those whose
// subject is still oldEmail (the OAuth subject of a grant is the email typed
// on the consent page). Run after an admin changed the user's email.
func (u *UserRepository) RevokeUserSessions(ctx context.Context, userID, oldEmail string) error {
	return txhelper.InTx(ctx, u.db, func(q txhelper.Querier) error {
		if _, err := q.ExecContext(ctx, `UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`, userID); err != nil {
			return fmt.Errorf("revoke refresh tokens: %w", err)
		}
		if _, err := q.ExecContext(ctx, `DELETE FROM mcp_oauth_tokens WHERE user_id = $1 OR (subject = $2 AND $2 <> '')`, userID, oldEmail); err != nil {
			return fmt.Errorf("revoke mcp oauth tokens: %w", err)
		}
		if _, err := q.ExecContext(ctx, `DELETE FROM mcp_oauth_authorization_codes WHERE subject = $1 AND $1 <> ''`, oldEmail); err != nil {
			return fmt.Errorf("revoke mcp oauth codes: %w", err)
		}
		return nil
	})
}

func (u *UserRepository) Save(ctx context.Context, user *domainUser.User) error {
	_, err := txhelper.FromContext(ctx, u.db).ExecContext(ctx, "INSERT INTO users (id, name , last_name,email, password,token, confirmed, is_demo, ip_address, role) VALUES ($1,$2,$3,$4,$5,$6, $7, $8, $9, $10)", user.Id, user.Name, user.LastName, user.Email, user.Password, user.Token, user.Confirmed, user.IsDemo, user.IpAddress, user.Role)
	return err
}

func (u *UserRepository) Update(ctx context.Context, user *domainUser.User) error {
	_, err := txhelper.FromContext(ctx, u.db).ExecContext(ctx, "UPDATE users SET name = $1, last_name = $2, email = $3, password = $4, token = $5, confirmed = $6, is_demo = $7, ip_address = $8, role = $9 WHERE id = $10",
		user.Name, user.LastName, user.Email, user.Password, user.Token, user.Confirmed, user.IsDemo, user.IpAddress, user.Role, user.Id)
	return err
}

// SoftDelete marks the user deleted and ends their access: API keys are
// deactivated and refresh tokens revoked, in one statement.
func (u *UserRepository) SoftDelete(ctx context.Context, id string) error {
	_, err := txhelper.FromContext(ctx, u.db).ExecContext(ctx, `WITH deleted AS (
			UPDATE users SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL RETURNING id
		), keys AS (
			UPDATE user_api_keys SET is_active = false WHERE user_id IN (SELECT id FROM deleted)
		)
		UPDATE refresh_tokens SET revoked_at = NOW()
		WHERE user_id IN (SELECT id FROM deleted) AND revoked_at IS NULL`, id)
	return err
}

func (u *UserRepository) FindUserById(ctx context.Context, id string) (*domainUser.User, error) {
	rows, err := txhelper.FromContext(ctx, u.db).QueryContext(ctx, "SELECT id, name, last_name, email, password, confirmed, is_demo, COALESCE(ip_address, ''), role, created_at FROM users WHERE id = $1 AND deleted_at IS NULL", id)
	if err != nil {
		return nil, err
	}
	defer func() {
		err = rows.Close()
		if err != nil {
			log.Error().Err(err).Msg("failed to close database rows")
		}
	}()

	user := domainUser.User{}
	for rows.Next() {
		if err = rows.Scan(&user.Id, &user.Name, &user.LastName, &user.Email, &user.Password, &user.Confirmed, &user.IsDemo, &user.IpAddress, &user.Role, &user.CreatedAt); err == nil {
			return &user, nil
		}
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}
	if user.Id == "" {
		return nil, errorhttp.ErrNotFound
	}
	return &user, nil
}

func (u *UserRepository) FindUserByIp(ctx context.Context, ip string) (*domainUser.User, error) {
	rows, err := txhelper.FromContext(ctx, u.db).QueryContext(ctx, "SELECT id ,name ,last_name, email ,password, confirmed, is_demo, COALESCE(ip_address, ''), role from users WHERE ip_address = $1 AND deleted_at IS NULL", ip)
	if err != nil {
		return nil, err
	}
	defer func() {
		err = rows.Close()
		if err != nil {
			log.Error().Err(err).Msg("failed to close database rows")
		}
	}()

	user := domainUser.User{}
	for rows.Next() {
		if err = rows.Scan(&user.Id, &user.Name, &user.LastName, &user.Email, &user.Password, &user.Confirmed, &user.IsDemo, &user.IpAddress, &user.Role); err != nil {
			return nil, err
		}
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}
	if user.Id == "" {
		return nil, errorhttp.ErrNotFound
	}
	return &user, nil
}

func (u *UserRepository) FindUserByEmail(ctx context.Context, email string) (*domainUser.User, error) {
	rows, err := txhelper.FromContext(ctx, u.db).QueryContext(ctx, "SELECT id ,name ,last_name, email ,password, confirmed, is_demo, COALESCE(ip_address, ''), role from users WHERE email = $1 AND deleted_at IS NULL", email)
	if err != nil {
		return nil, err
	}
	defer func() {
		err = rows.Close()
		if err != nil {
			log.Error().Err(err).Msg("failed to close database rows")
		}
	}()

	user := domainUser.User{}
	for rows.Next() {
		if err = rows.Scan(&user.Id, &user.Name, &user.LastName, &user.Email, &user.Password, &user.Confirmed, &user.IsDemo, &user.IpAddress, &user.Role); err != nil {
			return nil, err
		}
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}
	if user.Id == "" {
		return nil, errorhttp.ErrNotFound
	}
	return &user, nil
}

func (u *UserRepository) Delete(ctx context.Context, id string) error {
	_, err := txhelper.FromContext(ctx, u.db).ExecContext(ctx, "DELETE FROM users WHERE id = $1", id)
	return err
}

func (u *UserRepository) FindAll(ctx context.Context) ([]*domainUser.User, error) {
	rows, err := txhelper.FromContext(ctx, u.db).QueryContext(ctx, "SELECT id, name, last_name, email, password, confirmed, is_demo, COALESCE(ip_address, ''), role, created_at FROM users WHERE deleted_at IS NULL ORDER BY created_at DESC")
	if err != nil {
		return nil, err
	}
	defer func() {
		err = rows.Close()
		if err != nil {
			log.Error().Err(err).Msg("failed to close database rows")
		}
	}()

	var users []*domainUser.User
	for rows.Next() {
		var user domainUser.User
		if err = rows.Scan(&user.Id, &user.Name, &user.LastName, &user.Email, &user.Password, &user.Confirmed, &user.IsDemo, &user.IpAddress, &user.Role, &user.CreatedAt); err != nil {
			return nil, err
		}
		users = append(users, &user)
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}
	return users, nil
}

func (u *UserRepository) FindAllFiltered(ctx context.Context, query string, limit int, offset int) ([]*domainUser.User, error) {
	if limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}
	if offset < 0 {
		offset = 0
	}

	baseQuery := `
		SELECT id, name, last_name, email, password, confirmed, is_demo, COALESCE(ip_address, ''), role, created_at
		FROM users
		WHERE deleted_at IS NULL
	`
	extraClause := ""
	args := make([]interface{}, 0)
	argIndex := 1

	query = strings.TrimSpace(query)
	if query != "" {
		extraClause = fmt.Sprintf(" AND (LOWER(name) LIKE LOWER($%d) OR LOWER(last_name) LIKE LOWER($%d) OR LOWER(email) LIKE LOWER($%d))", argIndex, argIndex, argIndex)
		args = append(args, likepattern.Contains(query))
		argIndex++
	}

	finalQuery := fmt.Sprintf("%s%s ORDER BY created_at DESC LIMIT $%d OFFSET $%d", baseQuery, extraClause, argIndex, argIndex+1)
	args = append(args, limit, offset)

	rows, err := txhelper.FromContext(ctx, u.db).QueryContext(ctx, finalQuery, args...)
	if err != nil {
		return nil, err
	}
	defer func() {
		err = rows.Close()
		if err != nil {
			log.Error().Err(err).Msg("failed to close database rows")
		}
	}()

	users := make([]*domainUser.User, 0)
	for rows.Next() {
		var user domainUser.User
		if err = rows.Scan(&user.Id, &user.Name, &user.LastName, &user.Email, &user.Password, &user.Confirmed, &user.IsDemo, &user.IpAddress, &user.Role, &user.CreatedAt); err != nil {
			return nil, err
		}
		users = append(users, &user)
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}

	return users, nil
}
