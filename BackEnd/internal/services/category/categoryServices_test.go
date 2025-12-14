package category

import (
	"context"
	"testing"

	"github.com/osmait/gestorDePresupuesto/internal/domain/category"
	dto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/category"
	"github.com/osmait/gestorDePresupuesto/internal/platform/utils"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

type MockCategoryRepository struct {
	mock.Mock
}

func (m *MockCategoryRepository) Save(ctx context.Context, category *category.Category) error {
	args := m.Called(ctx, category)
	return args.Error(0)
}

func (m *MockCategoryRepository) FindAll(ctx context.Context, userId string) ([]*category.Category, error) {
	args := m.Called(ctx, userId)
	return args.Get(0).([]*category.Category), args.Error(1)
}

func (m *MockCategoryRepository) Delete(ctx context.Context, id string, userId string) error {
	args := m.Called(ctx, id, userId)
	return args.Error(0)
}

func (m *MockCategoryRepository) FindOne(ctx context.Context, id string) (*category.Category, error) {
	args := m.Called(ctx, id)
	return args.Get(0).(*category.Category), args.Error(1)
}

func (m *MockCategoryRepository) Update(ctx context.Context, category *category.Category) error {
	args := m.Called(ctx, category)
	return args.Error(0)
}

func TestCreateCategory(t *testing.T) {
	mockRepo := &MockCategoryRepository{}
	ctx := context.Background()
	mockRepo.On("Save", ctx, mock.AnythingOfType("*category.Category")).Return(nil)
	category := utils.GetNewRandomCategory()
	categoryServices := NewCategoryServices(mockRepo)
	categoryRequest := dto.NewCategoryRequest(category.Name, category.Icon, category.Color)
	err := categoryServices.CreateCategory(ctx, categoryRequest, category.UserId)
	assert.NoError(t, err, "CreateCategory should not return an error")

	mockRepo.AssertExpectations(t)
}

func TestFindAll(t *testing.T) {
	mockRepo := &MockCategoryRepository{}
	ctx := context.Background()
	expectedCategory := []*category.Category{}
	for i := 0; i < 10; i++ {
		expectedCategory = append(expectedCategory, utils.GetNewRandomCategory())
	}
	mockRepo.On("FindAll", ctx, "1").Return(expectedCategory, nil) // Corrected: added ctx and userId to Called arguments

	categoryServices := NewCategoryServices(mockRepo)
	_, err := categoryServices.FindAll(ctx, "1")
	mockRepo.AssertExpectations(t)
	assert.NoError(t, err, "FindAll should not return an error")
}

func TestDeleteCategory(t *testing.T) {
	mockRepo := &MockCategoryRepository{}

	category := utils.GetNewRandomCategory()

	ctx := context.Background()
	mockRepo.On("FindOne", ctx, mock.Anything).Return(category, nil)
	mockRepo.On("Delete", ctx, mock.Anything, mock.Anything).Return(nil)
	categoryServices := NewCategoryServices(mockRepo)
	err := categoryServices.Delete(ctx, category.Id, category.UserId)
	mockRepo.AssertExpectations(t)
	assert.NoError(t, err, "DeleteAccount should not return an error")
}
