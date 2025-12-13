package postgress

import (
	"context"

	"github.com/osmait/gestorDePresupuesto/internal/domain/category"
)

type CategoryRepoInterface interface {
	Save(ctx context.Context, category *category.Category) error
	FindAll(ctx context.Context, userId string) ([]*category.Category, error)
	FindOne(ctx context.Context, id string) (*category.Category, error)
	Delete(ctx context.Context, id string, userId string) error
}
