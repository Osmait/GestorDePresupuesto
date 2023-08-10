package postgress

import (
	"context"
	"database/sql"
	"log"

	"github.com/osmait/gestorDePresupuesto/src/internals/domain/transaction"
)

type TransactionRepository struct {
	db *sql.DB
}

func NewTransactionRepository(db *sql.DB) *AccountRepository {
	return &AccountRepository{
		db: db,
	}
}

func (repo *TransactionRepository) Save(ctx context.Context, transaction *transaction.Transaction) error {

	_, err := repo.db.ExecContext(ctx, "INSERT INTO transactions (id,transaction_name,transaction_description,amount,type_transation,account_id) VALUES ($1,$2,$3,$4,$5,$6)", transaction.Id, transaction.Name, transaction.Description, transaction.Amount, transaction.TypeTransation, transaction.Account_id)

	return err
}
func (repo *TransactionRepository) FindAll(ctx context.Context, date1 string, date2 string, id string) ([]*transaction.Transaction, error) {
	rows, err := repo.db.QueryContext(ctx, "SELECT id,transaction_name,transaction_description,amount,type_transation,account_id,created_at FROM transactions WHERE  account_id = $1 and created_at BETWEEN $2 and $3 ", id, date1, date2)
	if err != nil {
		return nil, err
	}
	defer func() {
		err = rows.Close()
		if err != nil {
			log.Fatal(err)
		}

	}()

	var transactions []*transaction.Transaction
	for rows.Next() {
		var transaction = transaction.Transaction{}
		if err = rows.Scan(&transaction.Id, &transaction.Name, &transaction.Description, &transaction.Amount, &transaction.TypeTransation, &transaction.TypeTransation, &transaction.Created_at); err == nil {
			transactions = append(transactions, &transaction)
		}

	}

	if err = rows.Err(); err != nil {
		return nil, err
	}
	return transactions, nil
}
func (repo *TransactionRepository) Delete(ctx context.Context, id string) error {
	_, err := repo.db.ExecContext(ctx, "DELETE FROM transactions WHERE id = $1 ", id)

	return err
}
