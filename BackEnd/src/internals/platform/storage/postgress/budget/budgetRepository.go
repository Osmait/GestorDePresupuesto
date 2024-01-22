package postgress

import (
	"context"
	"database/sql"
	"log"

	"github.com/osmait/gestorDePresupuesto/src/internals/domain/budget"
)

type BudgetRepository struct {
	db *sql.DB
}

func NewBudgetRepository(db *sql.DB) *BudgetRepository {
	return &BudgetRepository{
		db: db,
	}
}

func (b *BudgetRepository) Save(ctx context.Context, budget *budget.Budget) error {
	_, err := b.db.ExecContext(ctx, "INSERT INTO budgets (id,category_id,user_id,amount) VALUES($1,$2,$3,$4)", budget.Id, budget.CategoryId, budget.UserId, budget.Amount)
	return err
}

func (b *BudgetRepository) FindAll(ctx context.Context, userId string) ([]*budget.Budget, error) {
	rows, err := b.db.QueryContext(ctx, "SELECT id,category_id,user_id,amount,created_at FROM budgets WHERE user_id = $1 ", userId)
	if err != nil {
		return nil, err
	}

	defer func() {
		err = rows.Close()
		if err != nil {
			log.Fatal(err)
		}
	}()

	var budgets []*budget.Budget

	for rows.Next() {
		var budget budget.Budget
		if err = rows.Scan(&budget.Id, &budget.CategoryId, &budget.UserId, &budget.Amount, &budget.CreatedAt); err == nil {
			budgets = append(budgets, &budget)
		}
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}
	return budgets, nil
}

func (b *BudgetRepository) FindOne(ctx context.Context, id string) (*budget.Budget, error) {
	rows, err := b.db.QueryContext(ctx, "SELECT id,category_id,user_id,amount,created_at FROM budgets WHERE id = $1 ", id)
	if err != nil {
		return nil, err
	}

	defer func() {
		err = rows.Close()
		if err != nil {
			log.Fatal(err)
		}
	}()

	var budget budget.Budget
	for rows.Next() {
		if err = rows.Scan(&budget.Id, &budget.CategoryId, &budget.UserId, &budget.Amount, &budget.CreatedAt); err != nil {
			return nil, err
		}
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}
	return &budget, nil
}

func (b *BudgetRepository) Delete(ctx context.Context, id string) error {
	_, err := b.db.ExecContext(ctx, "DELETE FROM budget WHERE id = $1", id)
	return err
}
