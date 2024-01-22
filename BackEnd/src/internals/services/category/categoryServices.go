package category

import (
	"context"

	"github.com/osmait/gestorDePresupuesto/src/internals/domain/category"
	dto "github.com/osmait/gestorDePresupuesto/src/internals/platform/dto/category"
	categoryRepo "github.com/osmait/gestorDePresupuesto/src/internals/platform/storage/postgress/category"
	"github.com/osmait/gestorDePresupuesto/src/internals/services/errorhttp"
	"github.com/segmentio/ksuid"
)

type CategoryServices struct {
	repository categoryRepo.CategoryRepoInteface
}

func NewCategoryServices(repo categoryRepo.CategoryRepoInteface) *CategoryServices {
	return &CategoryServices{
		repository: repo,
	}
}

func (c *CategoryServices) CreateCategory(ctx context.Context, categoryRequest *dto.CategoryRequest, userId string) error {
	uuid, err := ksuid.NewRandom()
	if err != nil {
		return err
	}
	id := uuid.String()

	categoryToSave := category.NewCategory(id, categoryRequest.Name, categoryRequest.Icon, categoryRequest.Color)
	categoryToSave.UserId = userId
	err = c.repository.Save(ctx, categoryToSave)
	return err
}

func (c *CategoryServices) FindAll(ctx context.Context, userId string) ([]*dto.CategoryResponse, error) {
	categorysList, err := c.repository.FindAll(ctx, userId)
	if err != nil {
		return nil, err
	}
	var categoryResponseList []*dto.CategoryResponse
	for _, category := range categorysList {
		categoryResonse := dto.NewCategoryResponse(category.Id, category.Name, category.Icon, category.Color, category.CreatedAt)
		categoryResponseList = append(categoryResponseList, categoryResonse)
	}
	return categoryResponseList, nil
}

func (c *CategoryServices) Delete(ctx context.Context, id string) error {
	categoryToDelete, err := c.repository.FindOne(ctx, id)
	if err != nil {
		return err
	}
	if categoryToDelete.Id != id {
		return errorhttp.ErrNotFound
	}
	err = c.repository.Delete(ctx, id)
	return err
}
