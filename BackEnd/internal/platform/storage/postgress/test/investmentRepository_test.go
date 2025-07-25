package postgress

import (
	"context"
	"testing"

	"github.com/osmait/gestorDePresupuesto/internal/domain/invesment"
	investmentRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/invesment"
	userRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/user"
	"github.com/osmait/gestorDePresupuesto/internal/platform/utils"
	"github.com/stretchr/testify/assert"
)

func TestInvestmentRepository(t *testing.T) {
	db := SetUpTest()
	ctx := context.Background()

	// Setup dependencies
	userRepository := userRepo.NewUserRepository(db)
	investmentRepository := investmentRepo.NewInvesmentRepository(db)

	// Create test user
	user := utils.GetNewRandomUser()
	err := userRepository.Save(ctx, user)
	assert.NoError(t, err)

	// Create test investment
	investment := utils.GetNewRandomInvestment()
	investment.UserId = user.Id

	// Test Save
	err = investmentRepository.Save(ctx, investment)
	assert.NoError(t, err)

	// Test FindOne
	foundInvestment, err := investmentRepository.FindOne(ctx, investment.Id)
	assert.NoError(t, err)
	assert.Equal(t, investment.Id, foundInvestment.Id)
	assert.Equal(t, investment.Name, foundInvestment.Name)
	assert.Equal(t, investment.Price, foundInvestment.Price)
	assert.Equal(t, investment.CurrentPrice, foundInvestment.CurrentPrice)
	assert.Equal(t, investment.Quantity, foundInvestment.Quantity)

	// Test FindAll - Now using correct user_id after fixing the bug
	investments, err := investmentRepository.FindAll(ctx, investment.UserId)
	assert.NoError(t, err)
	assert.NotEmpty(t, investments)

	// Test Delete
	err = investmentRepository.Delete(ctx, investment.Id)
	assert.NoError(t, err)

	// Verify deletion
	deletedInvestment, err := investmentRepository.FindOne(ctx, investment.Id)
	assert.NoError(t, err)
	assert.Equal(t, "", deletedInvestment.Id) // Should be empty after deletion

	// Cleanup
	err = userRepository.Delete(ctx, user.Id)
	assert.NoError(t, err)
}

func TestInvestmentRepository_FindOne_NotFound(t *testing.T) {
	db := SetUpTest()
	ctx := context.Background()
	investmentRepository := investmentRepo.NewInvesmentRepository(db)

	// Test FindOne with non-existent ID
	investment, err := investmentRepository.FindOne(ctx, "non-existent-id")
	assert.NoError(t, err)             // Current implementation doesn't return error for not found
	assert.Equal(t, "", investment.Id) // Should be empty when not found
}

func TestInvestmentRepository_FindAll_EmptyResult(t *testing.T) {
	db := SetUpTest()
	ctx := context.Background()
	investmentRepository := investmentRepo.NewInvesmentRepository(db)

	// Test FindAll with non-existent user ID
	investments, err := investmentRepository.FindAll(ctx, "non-existent-user-id")
	assert.NoError(t, err)
	assert.Empty(t, investments)
}

func TestInvestmentRepository_Multiple_Investments(t *testing.T) {
	db := SetUpTest()
	ctx := context.Background()

	// Setup dependencies
	userRepository := userRepo.NewUserRepository(db)
	investmentRepository := investmentRepo.NewInvesmentRepository(db)

	// Create test user
	user := utils.GetNewRandomUser()
	err := userRepository.Save(ctx, user)
	assert.NoError(t, err)

	// Create multiple investments
	var createdInvestments []*invesment.Invesment
	for i := 0; i < 3; i++ {
		investment := utils.GetNewRandomInvestment()
		investment.UserId = user.Id
		err = investmentRepository.Save(ctx, investment)
		assert.NoError(t, err)
		createdInvestments = append(createdInvestments, investment)
	}

	// Test that we can find each investment individually
	for _, investment := range createdInvestments {
		foundInvestment, err := investmentRepository.FindOne(ctx, investment.Id)
		assert.NoError(t, err)
		assert.Equal(t, investment.Id, foundInvestment.Id)
		assert.Equal(t, investment.Name, foundInvestment.Name)
	}

	// Cleanup
	for _, investment := range createdInvestments {
		err = investmentRepository.Delete(ctx, investment.Id)
		assert.NoError(t, err)
	}

	err = userRepository.Delete(ctx, user.Id)
	assert.NoError(t, err)
}
