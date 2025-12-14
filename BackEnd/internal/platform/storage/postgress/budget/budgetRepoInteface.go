package postgress

import (
	"context"

	"github.com/osmait/gestorDePresupuesto/internal/domain/budget"
)

type BudgetRepoInterface interface {
	Save(ctx context.Context, budget *budget.Budget) error
	FindAll(ctx context.Context, userId string) ([]*budget.Budget, error)
	Delete(ctx context.Context, id string, userId string) error
	FindOne(ctx context.Context, id string) (*budget.Budget, error)
	FindByCategory(ctx context.Context, categoryID string) (*budget.Budget, error)
	Update(ctx context.Context, budget *budget.Budget) error
}
