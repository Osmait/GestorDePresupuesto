package postgress

import (
	"context"
	"database/sql"

	"github.com/osmait/gestorDePresupuesto/internal/domain/transaction"
	"github.com/rs/zerolog/log"
)

type TransactionRepository struct {
	db *sql.DB
}

func NewTransactionRepository(db *sql.DB) *TransactionRepository {
	return &TransactionRepository{
		db: db,
	}
}

func (repo *TransactionRepository) Save(ctx context.Context, transaction *transaction.Transaction) error {
	_, err := repo.db.ExecContext(ctx, "INSERT INTO transactions (id,transaction_name,transaction_description,amount,type_transation,account_id,user_id,category_id,budget_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)", transaction.Id, transaction.Name, transaction.Description, transaction.Amount, transaction.TypeTransation, transaction.AccountId, transaction.UserId, transaction.CategoryId, transaction.BudgetId)

	return err
}

func (repo *TransactionRepository) FindAllOfAllAccounts(ctx context.Context, id string) ([]*transaction.Transaction, error) {
	rows, err := repo.db.QueryContext(ctx,
		"SELECT id,transaction_name,transaction_description,amount,type_transation,account_id,category_id,budget_id,created_at FROM transactions WHERE  user_id = $1  ", id)
	if err != nil {
		return nil, err
	}
	defer func() {
		err = rows.Close()
		if err != nil {
			log.Error().Err(err).Msg("failed to close database rows")
		}
	}()

	var transactions []*transaction.Transaction
	for rows.Next() {
		transaction := transaction.Transaction{}
		var budgetID sql.NullString
		if err = rows.Scan(&transaction.Id, &transaction.Name, &transaction.Description, &transaction.Amount, &transaction.TypeTransation, &transaction.AccountId, &transaction.CategoryId, &budgetID, &transaction.CreatedAt); err == nil {
			if budgetID.Valid {
				transaction.BudgetId = budgetID.String
			}
			transactions = append(transactions, &transaction)
		}

	}

	if err = rows.Err(); err != nil {
		return nil, err
	}
	return transactions, nil
}

func (repo *TransactionRepository) FindAll(ctx context.Context, date1 string, date2 string, id string) ([]*transaction.Transaction, error) {
	rows, err := repo.db.QueryContext(ctx,
		"SELECT id,transaction_name,transaction_description,amount,type_transation,account_id,category_id,budget_id,created_at FROM transactions WHERE  account_id = $1 and created_at BETWEEN $2 and $3 ", id, date1, date2)
	if err != nil {
		return nil, err
	}
	defer func() {
		err = rows.Close()
		if err != nil {
			log.Error().Err(err).Msg("failed to close database rows")
		}
	}()

	var transactions []*transaction.Transaction
	for rows.Next() {
		transaction := transaction.Transaction{}
		var budgetID sql.NullString
		if err = rows.Scan(&transaction.Id, &transaction.Name, &transaction.Description, &transaction.Amount, &transaction.TypeTransation, &transaction.AccountId, &transaction.CategoryId, &budgetID, &transaction.CreatedAt); err == nil {
			if budgetID.Valid {
				transaction.BudgetId = budgetID.String
			}
			transactions = append(transactions, &transaction)
		}

	}

	if err = rows.Err(); err != nil {
		return nil, err
	}

	return transactions, nil
}

func (repo *TransactionRepository) FindCurrentBudget(ctx context.Context, budgetID string) (float64, error) {
	rows, err := repo.db.QueryContext(ctx,
		"SELECT   sum(amount)  as currentBudget FROM  transactions   WHERE  budget_id = $1  ", budgetID)
	if err != nil {
		return 0, err
	}
	defer func() {
		err = rows.Close()
		if err != nil {
			log.Error().Err(err).Msg("failed to close database rows")
		}
	}()
	var currentBudget float64
	for rows.Next() {
		if err = rows.Scan(&currentBudget); err == nil {
			return currentBudget, nil
		}
	}
	if err = rows.Err(); err != nil {
		log.Error().Err(err).Msg("error iterating over budget rows")
		return 0, err
	}

	return currentBudget, nil
}

func (repo *TransactionRepository) Delete(ctx context.Context, id string) error {
	_, err := repo.db.ExecContext(ctx, "DELETE FROM transactions WHERE id = $1 ", id)

	return err
}
