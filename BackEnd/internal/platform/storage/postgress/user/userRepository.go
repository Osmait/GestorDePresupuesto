package postgress

import (
	"context"
	"database/sql"

	"github.com/rs/zerolog/log"

	"github.com/osmait/gestorDePresupuesto/internal/domain/user"
	"github.com/osmait/gestorDePresupuesto/internal/services/errorhttp"
)

type UserRepository struct {
	db *sql.DB
}

func NewUserRepository(db *sql.DB) *UserRepository {
	return &UserRepository{db: db}
}

func (u *UserRepository) Save(ctx context.Context, user *user.User) error {
	_, err := u.db.ExecContext(ctx, "INSERT INTO users (id, name , last_name,email, password,token, confirmed, is_demo, ip_address) VALUES ($1,$2,$3,$4,$5,$6, $7, $8, $9)", user.Id, user.Name, user.LastName, user.Email, user.Password, user.Token, user.Confirmed, user.IsDemo, user.IpAddress)
	return err
}

func (u *UserRepository) FindUserByIp(ctx context.Context, ip string) (*user.User, error) {
	rows, err := u.db.QueryContext(ctx, "SELECT id ,name ,last_name, email ,password, confirmed, is_demo, ip_address from users WHERE ip_address = $1", ip)
	if err != nil {
		return nil, err
	}
	defer func() {
		err = rows.Close()
		if err != nil {
			log.Error().Err(err).Msg("failed to close database rows")
		}
	}()

	user := user.User{}
	for rows.Next() {
		if err = rows.Scan(&user.Id, &user.Name, &user.LastName, &user.Email, &user.Password, &user.Confirmed, &user.IsDemo, &user.IpAddress); err != nil {
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

func (u *UserRepository) FindUserByEmail(ctx context.Context, email string) (*user.User, error) {
	rows, err := u.db.QueryContext(ctx, "SELECT id ,name ,last_name, email ,password, confirmed, is_demo from users WHERE email = $1", email)
	if err != nil {
		return nil, err
	}
	defer func() {
		err = rows.Close()
		if err != nil {
			log.Error().Err(err).Msg("failed to close database rows")
		}
	}()

	user := user.User{}
	for rows.Next() {
		if err = rows.Scan(&user.Id, &user.Name, &user.LastName, &user.Email, &user.Password, &user.Confirmed, &user.IsDemo); err != nil {
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

func (u *UserRepository) FindUserById(ctx context.Context, id string) (*user.User, error) {
	rows, err := u.db.QueryContext(ctx, "SELECT id,name,last_name,email FROM users WHERE id = $1", id)
	if err != nil {
		return nil, err
	}
	defer func() {
		err = rows.Close()
		if err != nil {
			log.Error().Err(err).Msg("failed to close database rows")
		}
	}()
	user := user.User{}
	for rows.Next() {
		if err = rows.Scan(&user.Id, &user.Name, &user.LastName, &user.Email); err == nil {
			return &user, nil
		}
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}
	return &user, nil
}

func (u *UserRepository) Delete(ctx context.Context, id string) error {
	_, err := u.db.ExecContext(ctx, "DELETE FROM users WHERE id = $1", id)
	return err
}
