package postgress

import (
	"context"
	"database/sql"

	"github.com/osmait/gestorDePresupuesto/internal/domain/budget"
	"github.com/rs/zerolog/log"
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

func (b *BudgetRepository) Update(ctx context.Context, budget *budget.Budget) error {
	_, err := b.db.ExecContext(ctx, "UPDATE budgets SET amount = $1, category_id = $2 WHERE id = $3 AND user_id = $4", budget.Amount, budget.CategoryId, budget.Id, budget.UserId)
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
			log.Error().Err(err).Msg("failed to close database rows")
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
			log.Error().Err(err).Msg("failed to close database rows")
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

func (b *BudgetRepository) Delete(ctx context.Context, id string, userId string) error {
	result, err := b.db.ExecContext(ctx, "DELETE FROM budgets WHERE id = $1 AND user_id = $2", id, userId)
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

func (b *BudgetRepository) FindByCategory(ctx context.Context, categoryID string) (*budget.Budget, error) {
	rows, err := b.db.QueryContext(ctx, "SELECT id,category_id,user_id,amount,created_at FROM budgets WHERE category_id = $1 ", categoryID)
	if err != nil {
		return nil, err
	}
	defer func() {
		err = rows.Close()
		if err != nil {
			log.Error().Err(err).Msg("failed to close database rows")
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

func (b *BudgetRepository) Search(ctx context.Context, userId string, query string) ([]*budget.Budget, error) {
	searchTerm := "%" + query + "%"
	// Join with categories to search by category name since budgets don't have own names
	querySQL := `
		SELECT b.id, b.category_id, b.user_id, b.amount, b.created_at, c.name 
		FROM budgets b
		LEFT JOIN categorys c ON b.category_id = c.id
		WHERE b.user_id = $1 AND c.name ILIKE $2
	`
	rows, err := b.db.QueryContext(ctx, querySQL, userId, searchTerm)
	if err != nil {
		return nil, err
	}
	defer func() {
		err = rows.Close()
		if err != nil {
			log.Error().Err(err).Msg("failed to close database rows")
		}
	}()

	var budgets []*budget.Budget
	for rows.Next() {
		var bud budget.Budget
		if err = rows.Scan(&bud.Id, &bud.CategoryId, &bud.UserId, &bud.Amount, &bud.CreatedAt, &bud.CategoryName); err == nil {
			budgets = append(budgets, &bud)
		}
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}
	return budgets, nil
}
