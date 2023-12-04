package postgress

import (
	"context"
	"database/sql"
	"log"

	"github.com/osmait/gestorDePresupuesto/src/internals/domain/user"
)

type UserRepository struct {
	db *sql.DB
}

func NewUserRespository(db *sql.DB) *UserRepository {
	return &UserRepository{db: db}
}

func (u *UserRepository) CreateUser(ctx context.Context, user *user.User) error {
	_, err := u.db.ExecContext(ctx, "INSERT INTO users (id, name , last_name,email, password,token) VALUES ($1,$2,$3,$4,$5,$6)", user.Id, user.Name, user.LastName, user.Email, user.Password, user.Token)
	return err
}

func (u *UserRepository) findUser(ctx context.Context, id string) (*user.User, error) {
	rows, err := u.db.QueryContext(ctx, "SELECT id,name,last_name,email FROM users WHERE id = $1", id)
	if err != nil {
		return nil, err
	}
	defer func() {
		err = rows.Close()
		if err != nil {
			log.Fatal(err)
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
