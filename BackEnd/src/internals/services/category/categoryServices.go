package category

import (
	"context"

	"github.com/osmait/gestorDePresupuesto/src/internals/domain/category"
	"github.com/osmait/gestorDePresupuesto/src/internals/platform/storage/postgress"
	"github.com/osmait/gestorDePresupuesto/src/internals/services/errorhttp"
)

type CategoryServices struct {
	repository postgress.CategoryRepoInteface
}

func NewCategoryServices(repo postgress.CategoryRepoInteface) *CategoryServices {
	return &CategoryServices{
		repository: repo,
	}
}

func (c *CategoryServices) CreateCategory(ctx context.Context, category *category.Category) error {
	err := c.repository.Save(ctx, category)
	return err
}

func (c *CategoryServices) FindAll(ctx context.Context, userId string) ([]*category.Category, error) {
	categorys, err := c.repository.FindAll(ctx, userId)
	if err != nil {
		return nil, err
	}
	return categorys, nil
}

func (c *CategoryServices) Delete(ctx context.Context, id string) error {
	category, err := c.repository.FindOne(ctx, id)
	if err != nil {
		return err
	}
	if category.Id != id {
		return errorhttp.ErrNotFound
	}
	err = c.repository.Delete(ctx, id)
	return err
}
