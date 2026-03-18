package postgress

import (
	"context"
	"database/sql"

	"github.com/osmait/gestorDePresupuesto/internal/domain/account"
	txhelper "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/txhelper"
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
	_, err := txhelper.FromContext(ctx, repo.db).ExecContext(ctx, "INSERT INTO account (id,name_account,bank,balance,user_id,account_type,currency) VALUES ($1,$2,$3,$4,$5,$6,$7)", account.Id, account.Name, account.Bank, account.InitialBalance, account.UserId, account.Type, account.Currency)
	return err
}

func (repo *AccountRepository) FindAll(ctx context.Context, userId string) ([]*account.Account, error) {
	rows, err := txhelper.FromContext(ctx, repo.db).QueryContext(ctx, "SELECT id,name_account,bank,balance,account_type,currency FROM account WHERE user_id = $1", userId)
	if err != nil {
		return nil, err
	}
	defer func() {
		err = rows.Close()
		if err != nil {
			log.Error().Err(err).Msg("failed to close database rows")
		}
	}()
	accounts := make([]*account.Account, 0)
	for rows.Next() {
		acc := account.Account{}
		if err = rows.Scan(&acc.Id, &acc.Name, &acc.Bank, &acc.InitialBalance, &acc.Type, &acc.Currency); err == nil {
			accounts = append(accounts, &acc)
		}

	}

	if err = rows.Err(); err != nil {
		return nil, err
	}
	return accounts, nil
}

func (repo *AccountRepository) FindById(ctx context.Context, id string) (*account.Account, error) {
	row := txhelper.FromContext(ctx, repo.db).QueryRowContext(ctx, "SELECT id, name_account, bank, balance, user_id, account_type, currency, created_at FROM account WHERE id = $1", id)

	acc := &account.Account{}
	err := row.Scan(&acc.Id, &acc.Name, &acc.Bank, &acc.InitialBalance, &acc.UserId, &acc.Type, &acc.Currency, &acc.CreatedAt)
	if err != nil {
		return nil, err
	}
	return acc, nil
}

func (repo *AccountRepository) Delete(ctx context.Context, id string, userId string) error {
	result, err := txhelper.FromContext(ctx, repo.db).ExecContext(ctx, "DELETE FROM account WHERE id = $1 AND user_id = $2", id, userId)
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

func (repo *AccountRepository) Balance(ctx context.Context, id string) (float64, error) {
	rows, err := txhelper.FromContext(ctx, repo.db).QueryContext(ctx, `SELECT COALESCE(SUM(CASE
    WHEN type_transation IN ('income','loan_collection','loan_cancellation_refund')
    THEN amount
    ELSE -amount
END), 0) AS TOTAL
FROM transactions
WHERE account_id = $1`, id)
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

func (repo *AccountRepository) BalanceByCurrency(ctx context.Context, id string, currency string) (float64, error) {
	query := `SELECT COALESCE(SUM(CASE
    WHEN type_transation IN ('income','loan_collection','loan_cancellation_refund')
    THEN amount
    ELSE -amount
END), 0) FROM transactions WHERE account_id = $1 AND (currency = $2 OR ($2 = 'DOP' AND currency IS NULL))`
	row := txhelper.FromContext(ctx, repo.db).QueryRowContext(ctx, query, id, currency)

	var total float64
	err := row.Scan(&total)
	if err != nil {
		return 0, err
	}
	return total, nil
}

func (repo *AccountRepository) Balances(ctx context.Context, userId string) (map[string]float64, error) {
	rows, err := txhelper.FromContext(ctx, repo.db).QueryContext(ctx, `SELECT account_id, COALESCE(SUM(CASE
    WHEN type_transation IN ('income','loan_collection','loan_cancellation_refund')
    THEN amount
    ELSE -amount
END), 0) AS TOTAL FROM transactions WHERE user_id = $1 GROUP BY account_id`, userId)
	if err != nil {
		return nil, err
	}
	defer func() {
		err = rows.Close()
		if err != nil {
			log.Error().Err(err).Msg("failed to close database rows")
		}
	}()

	balances := make(map[string]float64)
	for rows.Next() {
		var accountId string
		var total float64
		if err = rows.Scan(&accountId, &total); err == nil {
			balances[accountId] = total
		}
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}
	return balances, nil
}

func (repo *AccountRepository) Update(ctx context.Context, id string, name string, bank string, userId string) error {
	result, err := txhelper.FromContext(ctx, repo.db).ExecContext(ctx, "UPDATE account SET name_account = $1, bank = $2 WHERE id = $3 AND user_id = $4", name, bank, id, userId)
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
	row := txhelper.FromContext(ctx, repo.db).QueryRowContext(ctx, "SELECT id, name_account, bank, balance, user_id, account_type, currency, created_at FROM account WHERE id = $1 AND user_id = $2", id, userId)

	acc := &account.Account{}
	err := row.Scan(&acc.Id, &acc.Name, &acc.Bank, &acc.InitialBalance, &acc.UserId, &acc.Type, &acc.Currency, &acc.CreatedAt)
	if err != nil {
		return nil, err
	}

	return acc, nil
}

func (repo *AccountRepository) Search(ctx context.Context, userId string, query string) ([]*account.Account, error) {
	searchTerm := "%" + query + "%"
	rows, err := txhelper.FromContext(ctx, repo.db).QueryContext(ctx, "SELECT id, name_account, bank, balance, user_id, account_type, currency, created_at FROM account WHERE user_id = $1 AND (name_account ILIKE $2 OR bank ILIKE $2)", userId, searchTerm)
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
		acc := account.Account{}
		if err = rows.Scan(&acc.Id, &acc.Name, &acc.Bank, &acc.InitialBalance, &acc.UserId, &acc.Type, &acc.Currency, &acc.CreatedAt); err == nil {
			accounts = append(accounts, &acc)
		}
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}
	return accounts, nil
}
