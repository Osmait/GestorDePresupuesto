package postgress

import (
	"context"

	"github.com/osmait/gestorDePresupuesto/internal/domain/budget"
)

// BudgetRepoInterface persists budgets. Every method is scoped to the owning
// user; budgets of other users are reported as not found.
type BudgetRepoInterface interface {
	Save(ctx context.Context, budget *budget.Budget) error
	FindAll(ctx context.Context, userId string) ([]*budget.Budget, error)
	Delete(ctx context.Context, id string, userId string) error
	FindOne(ctx context.Context, id string, userId string) (*budget.Budget, error)
	FindByCategory(ctx context.Context, categoryID string, userId string) (*budget.Budget, error)
	Update(ctx context.Context, budget *budget.Budget) error
	Search(ctx context.Context, userId string, query string) ([]*budget.Budget, error)
}
