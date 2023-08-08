package postgress

import (
	"context"
	"database/sql"

	"github.com/osmait/gestorDePresupuesto/src/internals/domain/account"
)

type AccountRepository struct {
	db *sql.DB
}

func NewCourseRepository(db *sql.DB) *AccountRepository {
	return &AccountRepository{
		db: db,
	}
}
func (repo *AccountRepository) Save(ctx context.Context, account account.Account) error {

	_, err := repo.db.ExecContext(ctx, "INSERT INTO account (id,name_account,bank,balance) VALUES ($1,$2,$3,$4)", account.Id, account.Name, account.Bank, account.Balance)
	return err
}
