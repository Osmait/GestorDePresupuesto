package postgress

import (
	"context"

	"github.com/osmait/gestorDePresupuesto/src/internals/domain/category"
)

type CategoryRepoInteface interface {
	Save(ctx context.Context, category *category.Category) error
	FindAll(ctx context.Context, userId string) ([]*category.Category, error)
	FindOne(ctx context.Context, id string) (*category.Category, error)
	Delete(ctx context.Context, id string) error
}
