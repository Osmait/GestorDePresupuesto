package postgress

import (
	"context"
	"database/sql"
	"log"

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

func (repo *AccountRepository) FindAll(ctx context.Context) ([]*account.Account, error) {

	rows, err := repo.db.QueryContext(ctx, "SELECT id,name_account,bank,balance FROM account")

	if err != nil {
		return nil, err
	}
	defer func() {
		err = rows.Close()
		if err != nil {
			log.Fatal(err)
		}

	}()
	var accounts []*account.Account
	for rows.Next() {
		var account = account.Account{}
		if err = rows.Scan(&account.Id, &account.Name, &account.Bank, &account.Balance); err == nil {
			accounts = append(accounts, &account)
		}

	}

	if err = rows.Err(); err != nil {
		return nil, err
	}
	return accounts, nil
}
