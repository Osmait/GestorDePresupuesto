package postgress

import (
	"context"
	"database/sql"
	"strings"
	"time"

	"github.com/rs/zerolog/log"

	domainUser "github.com/osmait/gestorDePresupuesto/internal/domain/user"
	"github.com/osmait/gestorDePresupuesto/internal/services/errorhttp"
)

type UserRepository struct {
	db *sql.DB
}

func NewUserRepository(db *sql.DB) *UserRepository {
	return &UserRepository{db: db}
}

// DeleteDemoUsersOlderThan deletes all demo users created before the specified time
func (u *UserRepository) DeleteDemoUsersOlderThan(ctx context.Context, olderThan time.Time) error {
	tx, err := u.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	// Defer a rollback in case anything fails.
	defer func() {
		_ = tx.Rollback()
	}()

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

	// Commit the transaction.
	if err = tx.Commit(); err != nil {
		return err
	}

	return nil
}

func (u *UserRepository) Save(ctx context.Context, user *domainUser.User) error {
	_, err := u.db.ExecContext(ctx, "INSERT INTO users (id, name , last_name,email, password,token, confirmed, is_demo, ip_address, role) VALUES ($1,$2,$3,$4,$5,$6, $7, $8, $9, $10)", user.Id, user.Name, user.LastName, user.Email, user.Password, user.Token, user.Confirmed, user.IsDemo, user.IpAddress, user.Role)
	return err
}

func (u *UserRepository) Update(ctx context.Context, user *domainUser.User) error {
	_, err := u.db.ExecContext(ctx, "UPDATE users SET name = $1, last_name = $2, email = $3, password = $4, token = $5, confirmed = $6, is_demo = $7, ip_address = $8, role = $9 WHERE id = $10",
		user.Name, user.LastName, user.Email, user.Password, user.Token, user.Confirmed, user.IsDemo, user.IpAddress, user.Role, user.Id)
	return err
}

func (u *UserRepository) FindUserById(ctx context.Context, id string) (*domainUser.User, error) {
	rows, err := u.db.QueryContext(ctx, "SELECT id, name, last_name, email, password, confirmed, is_demo, COALESCE(ip_address, ''), role, created_at FROM users WHERE id = $1", id)
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
	rows, err := u.db.QueryContext(ctx, "SELECT id ,name ,last_name, email ,password, confirmed, is_demo, COALESCE(ip_address, ''), role from users WHERE ip_address = $1", ip)
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
	rows, err := u.db.QueryContext(ctx, "SELECT id ,name ,last_name, email ,password, confirmed, is_demo, COALESCE(ip_address, ''), role from users WHERE email = $1", email)
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
	_, err := u.db.ExecContext(ctx, "DELETE FROM users WHERE id = $1", id)
	return err
}

func (u *UserRepository) FindAll(ctx context.Context) ([]*domainUser.User, error) {
	rows, err := u.db.QueryContext(ctx, "SELECT id, name, last_name, email, password, confirmed, is_demo, COALESCE(ip_address, ''), role, created_at FROM users ORDER BY created_at DESC")
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
