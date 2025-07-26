package postgress

import (
	"context"
	"database/sql"

	"github.com/osmait/gestorDePresupuesto/internal/domain/account"
	"github.com/rs/zerolog/log"
)

type AccountRepository struct {
	db *sql.DB
}

func NewAccountRepository(db *sql.DB) *AccountRepository {
	return &AccountRepository{
		db: db,
	}
}

func (repo *AccountRepository) Save(ctx context.Context, account *account.Account) error {
	_, err := repo.db.ExecContext(ctx, "INSERT INTO account (id,name_account,bank,balance,user_id) VALUES ($1,$2,$3,$4,$5)", account.Id, account.Name, account.Bank, account.InitialBalance, account.UserId)
	return err
}

func (repo *AccountRepository) FindAll(ctx context.Context, userId string) ([]*account.Account, error) {
	rows, err := repo.db.QueryContext(ctx, "SELECT id,name_account,bank,balance FROM account WHERE user_id = $1", userId)
	if err != nil {
		return nil, err
	}
	defer func() {
		err = rows.Close()
		if err != nil {
			log.Error().Err(err).Msg("failed to close database rows")
		}
	}()
	var accounts []*account.Account
	for rows.Next() {
		account := account.Account{}
		if err = rows.Scan(&account.Id, &account.Name, &account.Bank, &account.InitialBalance); err == nil {
			accounts = append(accounts, &account)
		}

	}

	if err = rows.Err(); err != nil {
		return nil, err
	}
	return accounts, nil
}

func (repo *AccountRepository) Delete(ctx context.Context, id string) error {
	_, err := repo.db.ExecContext(ctx, "DELETE FROM account WHERE id = $1  ", id)
	return err
}

func (repo *AccountRepository) Balance(ctx context.Context, id string) (float64, error) {
	rows, err := repo.db.QueryContext(ctx, "SELECT   sum(amount)  as TOTAL  FROM  transactions   WHERE account_id = $1 ", id)
	if err != nil {
		return 0, err
	}
	defer func() {
		err = rows.Close()
		if err != nil {
			log.Error().Err(err).Msg("failed to close database rows")
		}
	}()
	var total float64
	for rows.Next() {
		if err = rows.Scan(&total); err == nil {
			return total, nil
		}
	}
	if err = rows.Err(); err != nil {
		log.Error().Err(err).Msg("error iterating over account balance rows")
		return 0, err
	}

	return total, nil
}

func (repo *AccountRepository) Update(ctx context.Context, id string, name string, bank string, userId string) error {
	result, err := repo.db.ExecContext(ctx, "UPDATE account SET name_account = $1, bank = $2 WHERE id = $3 AND user_id = $4", name, bank, id, userId)
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

func (repo *AccountRepository) FindByIdAndUserId(ctx context.Context, id string, userId string) (*account.Account, error) {
	row := repo.db.QueryRowContext(ctx, "SELECT id, name_account, bank, balance, user_id, created_at FROM account WHERE id = $1 AND user_id = $2", id, userId)

	account := &account.Account{}
	err := row.Scan(&account.Id, &account.Name, &account.Bank, &account.InitialBalance, &account.UserId, &account.CreatedAt)
	if err != nil {
		return nil, err
	}

	return account, nil
}
