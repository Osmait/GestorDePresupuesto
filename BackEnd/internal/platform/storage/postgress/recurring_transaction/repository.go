package recurring_transaction

import (
	"context"
	"database/sql"
	"time"

	"github.com/osmait/gestorDePresupuesto/internal/domain/recurring_transaction"
)

type RecurringTransactionRepository struct {
	db *sql.DB
}

func NewRecurringTransactionRepository(db *sql.DB) *RecurringTransactionRepository {
	return &RecurringTransactionRepository{db: db}
}

func (r *RecurringTransactionRepository) Save(ctx context.Context, rt *recurring_transaction.RecurringTransaction) error {
	query := `INSERT INTO recurring_transactions (id, user_id, name, description, amount, type, account_id, category_id, budget_id, day_of_month, created_at, updated_at) 
			  VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`
	_, err := r.db.ExecContext(ctx, query, rt.ID, rt.UserID, rt.Name, rt.Description, rt.Amount, rt.Type, rt.AccountID, rt.CategoryID, rt.BudgetID, rt.DayOfMonth, rt.CreatedAt, rt.UpdatedAt)
	return err
}

func (r *RecurringTransactionRepository) Update(ctx context.Context, rt *recurring_transaction.RecurringTransaction) error {
	query := `UPDATE recurring_transactions 
			  SET name=$1, description=$2, amount=$3, type=$4, account_id=$5, category_id=$6, budget_id=$7, day_of_month=$8, last_execution_date=$9, updated_at=$10 
			  WHERE id=$11`
	_, err := r.db.ExecContext(ctx, query, rt.Name, rt.Description, rt.Amount, rt.Type, rt.AccountID, rt.CategoryID, rt.BudgetID, rt.DayOfMonth, rt.LastExecutionDate, time.Now().UTC(), rt.ID)
	return err
}

func (r *RecurringTransactionRepository) Delete(ctx context.Context, id string) error {
	query := `DELETE FROM recurring_transactions WHERE id=$1`
	_, err := r.db.ExecContext(ctx, query, id)
	return err
}

func (r *RecurringTransactionRepository) FindAllByUser(ctx context.Context, userID string) ([]*recurring_transaction.RecurringTransaction, error) {
	query := `SELECT id, user_id, name, description, amount, type, account_id, category_id, budget_id, day_of_month, last_execution_date, created_at, updated_at 
			  FROM recurring_transactions WHERE user_id=$1 ORDER BY created_at DESC`
	rows, err := r.db.QueryContext(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	var results []*recurring_transaction.RecurringTransaction
	for rows.Next() {
		var rt recurring_transaction.RecurringTransaction
		var budgetID sql.NullString
		var lastExecution sql.NullTime

		err := rows.Scan(&rt.ID, &rt.UserID, &rt.Name, &rt.Description, &rt.Amount, &rt.Type, &rt.AccountID, &rt.CategoryID, &budgetID, &rt.DayOfMonth, &lastExecution, &rt.CreatedAt, &rt.UpdatedAt)
		if err != nil {
			return nil, err
		}

		if budgetID.Valid {
			bid := budgetID.String
			rt.BudgetID = &bid
		}
		if lastExecution.Valid {
			t := lastExecution.Time
			rt.LastExecutionDate = &t
		}

		results = append(results, &rt)
	}
	return results, nil
}

func (r *RecurringTransactionRepository) FindDue(ctx context.Context, dayOfMonth int) ([]*recurring_transaction.RecurringTransaction, error) {
	// Find transactions that match the day of month AND (have never run OR ran in a previous month)
	// We use logic: last_execution_date IS NULL OR (EXTRACT(MONTH FROM last_execution_date) != EXTRACT(MONTH FROM CURRENT_DATE) OR EXTRACT(YEAR FROM last_execution_date) != EXTRACT(YEAR FROM CURRENT_DATE))
	// To be safer and simpler, we can check if last_execution_date < FirstDayOfCurrentMonth

	query := `SELECT id, user_id, name, description, amount, type, account_id, category_id, budget_id, day_of_month, last_execution_date, created_at, updated_at 
			  FROM recurring_transactions 
			  WHERE day_of_month = $1 
			  AND (last_execution_date IS NULL OR last_execution_date < date_trunc('month', CURRENT_DATE))`

	rows, err := r.db.QueryContext(ctx, query, dayOfMonth)
	if err != nil {
		return nil, err
	}
	defer func() { _ = rows.Close() }()

	var results []*recurring_transaction.RecurringTransaction
	for rows.Next() {
		var rt recurring_transaction.RecurringTransaction
		var budgetID sql.NullString
		var lastExecution sql.NullTime

		err := rows.Scan(&rt.ID, &rt.UserID, &rt.Name, &rt.Description, &rt.Amount, &rt.Type, &rt.AccountID, &rt.CategoryID, &budgetID, &rt.DayOfMonth, &lastExecution, &rt.CreatedAt, &rt.UpdatedAt)
		if err != nil {
			return nil, err
		}

		if budgetID.Valid {
			bid := budgetID.String
			rt.BudgetID = &bid
		}
		if lastExecution.Valid {
			t := lastExecution.Time
			rt.LastExecutionDate = &t
		}

		results = append(results, &rt)
	}
	return results, nil
}
