package postgress

import (
	"context"
	"database/sql"
	"errors"

	"github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/likepattern"

	"github.com/osmait/gestorDePresupuesto/internal/domain/budget"
	"github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/ownership"
	txhelper "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/txhelper"
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
	q := txhelper.FromContext(ctx, b.db)
	if budget.CategoryId == "" {
		return ownership.ErrReferenceNotOwned
	}
	if err := ownership.VerifyReference(ctx, q, budget.UserId, ownership.Category, budget.CategoryId); err != nil {
		return err
	}
	_, err := q.ExecContext(ctx, "INSERT INTO budgets (id,category_id,user_id,amount) VALUES($1,$2,$3,$4)", budget.Id, budget.CategoryId, budget.UserId, budget.Amount)
	return err
}

// Update changes a budget owned by budget.UserId. It returns ownership.ErrNotFound
// when the budget does not exist or belongs to another user, and
// ownership.ErrReferenceNotOwned when the new category is not the user's.
func (b *BudgetRepository) Update(ctx context.Context, budget *budget.Budget) error {
	q := txhelper.FromContext(ctx, b.db)

	var exists bool
	if err := q.QueryRowContext(ctx, "SELECT EXISTS (SELECT 1 FROM budgets WHERE id = $1 AND user_id = $2)", budget.Id, budget.UserId).Scan(&exists); err != nil {
		return err
	}
	if !exists {
		return ownership.ErrNotFound
	}
	if budget.CategoryId == "" {
		return ownership.ErrReferenceNotOwned
	}
	if err := ownership.VerifyReference(ctx, q, budget.UserId, ownership.Category, budget.CategoryId); err != nil {
		return err
	}

	result, err := q.ExecContext(ctx, "UPDATE budgets SET amount = $1, category_id = $2 WHERE id = $3 AND user_id = $4", budget.Amount, budget.CategoryId, budget.Id, budget.UserId)
	if err != nil {
		return err
	}
	return ownership.RequireAffected(result)
}

func (b *BudgetRepository) FindAll(ctx context.Context, userId string) ([]*budget.Budget, error) {
	rows, err := txhelper.FromContext(ctx, b.db).QueryContext(ctx, "SELECT id,category_id,user_id,amount,created_at FROM budgets WHERE user_id = $1 ", userId)
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

// FindOne returns the budget `id` owned by userId, or ownership.ErrNotFound.
func (b *BudgetRepository) FindOne(ctx context.Context, id string, userId string) (*budget.Budget, error) {
	row := txhelper.FromContext(ctx, b.db).QueryRowContext(ctx, "SELECT id,category_id,user_id,amount,created_at FROM budgets WHERE id = $1 AND user_id = $2", id, userId)

	var found budget.Budget
	if err := row.Scan(&found.Id, &found.CategoryId, &found.UserId, &found.Amount, &found.CreatedAt); err != nil {
		return nil, ownership.NotFoundIfNoRows(err)
	}
	return &found, nil
}

func (b *BudgetRepository) Delete(ctx context.Context, id string, userId string) error {
	result, err := txhelper.FromContext(ctx, b.db).ExecContext(ctx, "DELETE FROM budgets WHERE id = $1 AND user_id = $2", id, userId)
	if err != nil {
		return err
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return ownership.ErrNotFound
	}
	return nil
}

// FindByCategory returns the budget userId has for categoryID, or (nil, nil)
// when the user has no budget for that category.
func (b *BudgetRepository) FindByCategory(ctx context.Context, categoryID string, userId string) (*budget.Budget, error) {
	row := txhelper.FromContext(ctx, b.db).QueryRowContext(ctx,
		"SELECT id,category_id,user_id,amount,created_at FROM budgets WHERE category_id = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT 1", categoryID, userId)

	var found budget.Budget
	if err := row.Scan(&found.Id, &found.CategoryId, &found.UserId, &found.Amount, &found.CreatedAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &found, nil
}

func (b *BudgetRepository) Search(ctx context.Context, userId string, query string) ([]*budget.Budget, error) {
	searchTerm := likepattern.Contains(query)
	// Join with categories to search by category name since budgets don't have own names
	querySQL := `
		SELECT b.id, b.category_id, b.user_id, b.amount, b.created_at, c.name
		FROM budgets b
		LEFT JOIN categorys c ON b.category_id = c.id
		WHERE b.user_id = $1 AND c.name ILIKE $2
	`
	rows, err := txhelper.FromContext(ctx, b.db).QueryContext(ctx, querySQL, userId, searchTerm)
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
