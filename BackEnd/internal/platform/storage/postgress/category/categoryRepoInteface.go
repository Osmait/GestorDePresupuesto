package postgress

import (
	"context"

	"github.com/osmait/gestorDePresupuesto/internal/domain/category"
)

// CategoryRepoInterface persists categories. Every method is scoped to the
// owning user; categories of other users are reported as not found.
type CategoryRepoInterface interface {
	Save(ctx context.Context, category *category.Category) error
	FindAll(ctx context.Context, userId string) ([]*category.Category, error)
	FindOne(ctx context.Context, id string, userId string) (*category.Category, error)
	Delete(ctx context.Context, id string, userId string) error
	Update(ctx context.Context, category *category.Category) error
	Search(ctx context.Context, userId string, query string) ([]*category.Category, error)
}
