package postgress

import (
	"context"

	"github.com/osmait/gestorDePresupuesto/src/internals/domain/budget"
)

type BudgetRepoInterface interface {
	Save(ctx context.Context, budget *budget.Budget) error
	FindAll(ctx context.Context, userId string) ([]*budget.Budget, error)
	FindOne(ctx context.Context, id string) (*budget.Budget, error)
	Delete(ctx context.Context, id string) error
}
