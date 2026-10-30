package postgress

import (
	"context"
	"database/sql"

	"github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/likepattern"

	"github.com/osmait/gestorDePresupuesto/internal/domain/account"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
	"github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/ownership"
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

func (repo *AccountRepository) Delete(ctx context.Context, id string, userId string) error {
	result, err := txhelper.FromContext(ctx, repo.db).ExecContext(ctx, "DELETE FROM account WHERE id = $1 AND user_id = $2", id, userId)
	if err != nil {
		return err
	}
	return ownership.RequireAffected(result)
}

// The balance reads below use account_balances (migration 000052): per
// (user, account, currency) the net total of the account's transactions
// (income, loan_collection, loan_cancellation_refund and adjustment_in add,
// every other type subtracts; a NULL currency counts as DOP). Triggers on transactions keep it
// current inside the writing transaction. The total is striped over up to 32
// rows (one per writing connection slot, so concurrent writers do not queue on
// a single row) and summed on read: an index range scan of a few rows instead
// of a scan of the whole ledger. The account's initial balance is not
// included; callers add account.InitialBalance.

// Balance returns the net transaction total of account `id` counting only
// transactions owned by userId (all currencies).
func (repo *AccountRepository) Balance(ctx context.Context, id string, userId string) (money.Amount, error) {
	var total money.Amount
	err := txhelper.FromContext(ctx, repo.db).QueryRowContext(ctx,
		`SELECT COALESCE(SUM(balance), 0) FROM account_balances WHERE user_id = $1 AND account_id = $2`,
		userId, id).Scan(&total)
	if err != nil {
		return money.Zero, err
	}
	return total, nil
}

// BalanceByCurrency is Balance restricted to transactions in currency.
func (repo *AccountRepository) BalanceByCurrency(ctx context.Context, id string, userId string, currency string) (money.Amount, error) {
	var total money.Amount
	err := txhelper.FromContext(ctx, repo.db).QueryRowContext(ctx,
		`SELECT COALESCE(SUM(balance), 0) FROM account_balances WHERE user_id = $1 AND account_id = $2 AND currency = $3`,
		userId, id, currency).Scan(&total)
	if err != nil {
		return money.Zero, err
	}
	return total, nil
}

// Balances returns Balance for every account of userId that has transactions.
func (repo *AccountRepository) Balances(ctx context.Context, userId string) (map[string]money.Amount, error) {
	rows, err := txhelper.FromContext(ctx, repo.db).QueryContext(ctx,
		`SELECT account_id, SUM(balance) FROM account_balances WHERE user_id = $1 GROUP BY account_id`, userId)
	if err != nil {
		return nil, err
	}
	defer func() {
		err = rows.Close()
		if err != nil {
			log.Error().Err(err).Msg("failed to close database rows")
		}
	}()

	balances := make(map[string]money.Amount)
	for rows.Next() {
		var accountId string
		var total money.Amount
		if err = rows.Scan(&accountId, &total); err != nil {
			return nil, err
		}
		balances[accountId] = total
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

	return ownership.RequireAffected(result)
}

func (repo *AccountRepository) FindByIdAndUserId(ctx context.Context, id string, userId string) (*account.Account, error) {
	row := txhelper.FromContext(ctx, repo.db).QueryRowContext(ctx, "SELECT id, name_account, bank, balance, user_id, account_type, currency, created_at FROM account WHERE id = $1 AND user_id = $2", id, userId)

	acc := &account.Account{}
	err := row.Scan(&acc.Id, &acc.Name, &acc.Bank, &acc.InitialBalance, &acc.UserId, &acc.Type, &acc.Currency, &acc.CreatedAt)
	if err != nil {
		return nil, ownership.NotFoundIfNoRows(err)
	}

	return acc, nil
}

// FindByIdAndUserIdForUpdate is FindByIdAndUserId plus a row lock held until
// the request transaction ends. Every money movement that debits the account
// as a transfer source (card payment, broker funding, loan disbursement) takes
// this lock before reading the balance, so two concurrent debits are
// serialised and cannot both pass the funds check.
//
// The lock is FOR NO KEY UPDATE, not FOR UPDATE: it conflicts with itself (and
// with UPDATE/DELETE of the account) but not with the FOR KEY SHARE lock that
// the transactions.account_id foreign key takes, so ordinary transaction
// INSERTs on the same account do not wait for a payment to finish.
func (repo *AccountRepository) FindByIdAndUserIdForUpdate(ctx context.Context, id string, userId string) (*account.Account, error) {
	row := txhelper.FromContext(ctx, repo.db).QueryRowContext(ctx, "SELECT id, name_account, bank, balance, user_id, account_type, currency, created_at FROM account WHERE id = $1 AND user_id = $2 FOR NO KEY UPDATE", id, userId)

	acc := &account.Account{}
	err := row.Scan(&acc.Id, &acc.Name, &acc.Bank, &acc.InitialBalance, &acc.UserId, &acc.Type, &acc.Currency, &acc.CreatedAt)
	if err != nil {
		return nil, ownership.NotFoundIfNoRows(err)
	}

	return acc, nil
}

func (repo *AccountRepository) Search(ctx context.Context, userId string, query string) ([]*account.Account, error) {
	searchTerm := likepattern.Contains(query)
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
