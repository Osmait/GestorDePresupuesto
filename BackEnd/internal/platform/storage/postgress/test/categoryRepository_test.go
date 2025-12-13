package postgress

import (
	"context"
	"testing"

	categoryRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/category"
	userRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/user"
	"github.com/osmait/gestorDePresupuesto/internal/platform/utils"
	"github.com/stretchr/testify/assert"
)

func TestCategoryRepository(t *testing.T) {
	db := SetUpTest()
	ctx := context.Background()

	// Setup dependencies
	userRepository := userRepo.NewUserRepository(db)
	categoryRepository := categoryRepo.NewCategoryRepository(db)

	// Create test user
	user := utils.GetNewRandomUser()
	err := userRepository.Save(ctx, user)
	assert.NoError(t, err)

	// Create test category
	category := utils.GetNewRandomCategory()
	category.UserId = user.Id

	// Test Save
	err = categoryRepository.Save(ctx, category)
	assert.NoError(t, err)

	// Test FindOne
	foundCategory, err := categoryRepository.FindOne(ctx, category.Id)
	assert.NoError(t, err)
	assert.Equal(t, category.Id, foundCategory.Id)
	assert.Equal(t, category.Name, foundCategory.Name)
	assert.Equal(t, category.Icon, foundCategory.Icon)
	assert.Equal(t, category.Color, foundCategory.Color)
	assert.Equal(t, category.UserId, foundCategory.UserId)
	assert.NotZero(t, foundCategory.CreatedAt)

	// Test FindAll
	categories, err := categoryRepository.FindAll(ctx, user.Id)
	assert.NoError(t, err)
	assert.NotEmpty(t, categories)
	assert.Equal(t, 1, len(categories))
	assert.Equal(t, category.Id, categories[0].Id)

	// Test Delete
	err = categoryRepository.Delete(ctx, category.Id, user.Id)
	assert.NoError(t, err)

	// Verify deletion
	deletedCategory, err := categoryRepository.FindOne(ctx, category.Id)
	assert.NoError(t, err)
	assert.Equal(t, "", deletedCategory.Id) // Should be empty after deletion

	// Verify FindAll is empty after deletion
	categoriesAfterDelete, err := categoryRepository.FindAll(ctx, user.Id)
	assert.NoError(t, err)
	assert.Empty(t, categoriesAfterDelete)

	// Cleanup
	err = userRepository.Delete(ctx, user.Id)
	assert.NoError(t, err)
}

func TestCategoryRepository_FindOne_NotFound(t *testing.T) {
	db := SetUpTest()
	ctx := context.Background()
	categoryRepository := categoryRepo.NewCategoryRepository(db)

	// Test FindOne with non-existent ID
	category, err := categoryRepository.FindOne(ctx, "non-existent-id")
	assert.NoError(t, err)           // Current implementation doesn't return error for not found
	assert.Equal(t, "", category.Id) // Should be empty when not found
}

func TestCategoryRepository_FindAll_EmptyResult(t *testing.T) {
	db := SetUpTest()
	ctx := context.Background()
	categoryRepository := categoryRepo.NewCategoryRepository(db)

	// Test FindAll with non-existent user ID
	categories, err := categoryRepository.FindAll(ctx, "non-existent-user-id")
	assert.NoError(t, err)
	assert.Empty(t, categories)
}

func TestCategoryRepository_Multiple_Categories(t *testing.T) {
	db := SetUpTest()
	ctx := context.Background()

	// Setup dependencies
	userRepository := userRepo.NewUserRepository(db)
	categoryRepository := categoryRepo.NewCategoryRepository(db)

	// Create test user
	user := utils.GetNewRandomUser()
	err := userRepository.Save(ctx, user)
	assert.NoError(t, err)

	// Create multiple categories
	var createdCategories []string
	categoryNames := []string{"Food", "Transport", "Entertainment", "Health", "Shopping"}

	for i, name := range categoryNames {
		category := utils.GetNewRandomCategory()
		category.UserId = user.Id
		category.Name = name
		category.Icon = "icon-" + name
		category.Color = []string{"red", "blue", "green", "yellow", "purple"}[i]

		err = categoryRepository.Save(ctx, category)
		assert.NoError(t, err)
		createdCategories = append(createdCategories, category.Id)
	}

	// Test FindAll returns all categories for user
	categories, err := categoryRepository.FindAll(ctx, user.Id)
	assert.NoError(t, err)
	assert.Equal(t, len(categoryNames), len(categories))

	// Verify all categories are found
	foundNames := make(map[string]bool)
	for _, cat := range categories {
		foundNames[cat.Name] = true
		assert.Equal(t, user.Id, cat.UserId)
	}

	for _, expectedName := range categoryNames {
		assert.True(t, foundNames[expectedName], "Expected category %s to be found", expectedName)
	}

	// Test FindOne for each category
	for _, categoryId := range createdCategories {
		foundCategory, err := categoryRepository.FindOne(ctx, categoryId)
		assert.NoError(t, err)
		assert.Equal(t, categoryId, foundCategory.Id)
		assert.Equal(t, user.Id, foundCategory.UserId)
	}

	// Cleanup
	for _, categoryId := range createdCategories {
		err = categoryRepository.Delete(ctx, categoryId, user.Id)
		assert.NoError(t, err)
	}

	err = userRepository.Delete(ctx, user.Id)
	assert.NoError(t, err)
}

func TestCategoryRepository_User_Isolation(t *testing.T) {
	db := SetUpTest()
	ctx := context.Background()

	// Setup dependencies
	userRepository := userRepo.NewUserRepository(db)
	categoryRepository := categoryRepo.NewCategoryRepository(db)

	// Create two test users
	user1 := utils.GetNewRandomUser()
	user2 := utils.GetNewRandomUser()
	err := userRepository.Save(ctx, user1)
	assert.NoError(t, err)
	err = userRepository.Save(ctx, user2)
	assert.NoError(t, err)

	// Create categories for each user
	category1 := utils.GetNewRandomCategory()
	category1.UserId = user1.Id
	category1.Name = "User1 Category"

	category2 := utils.GetNewRandomCategory()
	category2.UserId = user2.Id
	category2.Name = "User2 Category"

	err = categoryRepository.Save(ctx, category1)
	assert.NoError(t, err)
	err = categoryRepository.Save(ctx, category2)
	assert.NoError(t, err)

	// Test that each user only sees their own categories
	user1Categories, err := categoryRepository.FindAll(ctx, user1.Id)
	assert.NoError(t, err)
	assert.Equal(t, 1, len(user1Categories))
	assert.Equal(t, "User1 Category", user1Categories[0].Name)

	user2Categories, err := categoryRepository.FindAll(ctx, user2.Id)
	assert.NoError(t, err)
	assert.Equal(t, 1, len(user2Categories))
	assert.Equal(t, "User2 Category", user2Categories[0].Name)

	// Cleanup
	err = categoryRepository.Delete(ctx, category1.Id, user1.Id)
	assert.NoError(t, err)
	err = categoryRepository.Delete(ctx, category2.Id, user2.Id)
	assert.NoError(t, err)
	err = userRepository.Delete(ctx, user1.Id)
	assert.NoError(t, err)
	err = userRepository.Delete(ctx, user2.Id)
	assert.NoError(t, err)
}
