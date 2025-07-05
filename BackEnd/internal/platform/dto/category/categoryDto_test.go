package dto

import (
	"testing"

	"github.com/go-playground/assert/v2"
	"github.com/osmait/gestorDePresupuesto/internal/platform/utils"
)

func TestCategoryRequest(t *testing.T) {
	category := utils.GetNewRandomCategory()
	categoryRequest := NewCategoryRequest(category.Name, category.Icon, category.Color)
	assert.Equal(t, category.Color, categoryRequest.Color)
	assert.Equal(t, category.Icon, categoryRequest.Icon)
	assert.Equal(t, category.Name, categoryRequest.Name)
}

func TestCategoryResponse(t *testing.T) {
	category := utils.GetNewRandomCategory()
	categoryResponse := NewCategoryResponse(category.Id, category.Name, category.Icon, category.Color, category.CreatedAt)
	assert.Equal(t, category.Color, categoryResponse.Color)
	assert.Equal(t, category.Icon, categoryResponse.Icon)
	assert.Equal(t, category.Name, categoryResponse.Name)
	assert.Equal(t, category.Id, categoryResponse.Id)
	assert.Equal(t, category.CreatedAt, categoryResponse.CreatedAt)
}
