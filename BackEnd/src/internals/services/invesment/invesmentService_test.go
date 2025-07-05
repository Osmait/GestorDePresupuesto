package invesment

import (
	"context"
	"errors"
	"testing"

	"github.com/osmait/gestorDePresupuesto/src/internals/domain/invesment"
	"github.com/osmait/gestorDePresupuesto/src/internals/platform/utils"
	"github.com/osmait/gestorDePresupuesto/src/internals/services/errorhttp"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

var (
	ErrRepositoryFailure = errors.New("repository failure")
)

type MockInvestmentRepository struct {
	mock.Mock
}

func (m *MockInvestmentRepository) Save(ctx context.Context, investment *invesment.Invesment) error {
	args := m.Called(ctx, investment)
	return args.Error(0)
}

func (m *MockInvestmentRepository) FindAll(ctx context.Context, userId string) ([]*invesment.Invesment, error) {
	args := m.Called(ctx, userId)
	return args.Get(0).([]*invesment.Invesment), args.Error(1)
}

func (m *MockInvestmentRepository) FindOne(ctx context.Context, id string) (*invesment.Invesment, error) {
	args := m.Called(ctx, id)
	return args.Get(0).(*invesment.Invesment), args.Error(1)
}

func (m *MockInvestmentRepository) Delete(ctx context.Context, id string) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func TestCreateInvestment(t *testing.T) {
	mockRepo := &MockInvestmentRepository{}
	investmentService := NewInvesmentServices(mockRepo)

	ctx := context.Background()
	investment := utils.GetNewRandomInvestment()

	mockRepo.On("Save", ctx, investment).Return(nil)

	err := investmentService.CreateInvesment(ctx, investment)

	assert.NoError(t, err, "CreateInvestment should not return an error")
	mockRepo.AssertExpectations(t)
}

func TestCreateInvestment_RepositoryError(t *testing.T) {
	mockRepo := &MockInvestmentRepository{}
	investmentService := NewInvesmentServices(mockRepo)

	ctx := context.Background()
	investment := utils.GetNewRandomInvestment()

	mockRepo.On("Save", ctx, investment).Return(ErrRepositoryFailure)

	err := investmentService.CreateInvesment(ctx, investment)

	assert.Error(t, err, "CreateInvestment should return an error when repository fails")
	assert.Equal(t, ErrRepositoryFailure, err)
	mockRepo.AssertExpectations(t)
}

func TestFindAllInvestments(t *testing.T) {
	mockRepo := &MockInvestmentRepository{}
	investmentService := NewInvesmentServices(mockRepo)

	ctx := context.Background()
	userId := "test-user-id"
	expectedInvestments := []*invesment.Invesment{}
	for i := 0; i < 5; i++ {
		investment := utils.GetNewRandomInvestment()
		investment.UserId = userId
		expectedInvestments = append(expectedInvestments, investment)
	}

	mockRepo.On("FindAll", ctx, userId).Return(expectedInvestments, nil)

	result, err := investmentService.FindAll(ctx, userId)

	assert.NoError(t, err, "FindAll should not return an error")
	assert.Equal(t, len(expectedInvestments), len(result))
	assert.Equal(t, expectedInvestments, result)
	mockRepo.AssertExpectations(t)
}

func TestFindAllInvestments_EmptyResult(t *testing.T) {
	mockRepo := &MockInvestmentRepository{}
	investmentService := NewInvesmentServices(mockRepo)

	ctx := context.Background()
	userId := "test-user-id"
	expectedInvestments := []*invesment.Invesment{}

	mockRepo.On("FindAll", ctx, userId).Return(expectedInvestments, nil)

	result, err := investmentService.FindAll(ctx, userId)

	assert.NoError(t, err, "FindAll should not return an error for empty result")
	assert.Empty(t, result)
	mockRepo.AssertExpectations(t)
}

func TestFindAllInvestments_RepositoryError(t *testing.T) {
	mockRepo := &MockInvestmentRepository{}
	investmentService := NewInvesmentServices(mockRepo)

	ctx := context.Background()
	userId := "test-user-id"

	mockRepo.On("FindAll", ctx, userId).Return([]*invesment.Invesment(nil), ErrRepositoryFailure)

	result, err := investmentService.FindAll(ctx, userId)

	assert.Error(t, err, "FindAll should return an error when repository fails")
	assert.Nil(t, result)
	assert.Equal(t, ErrRepositoryFailure, err)
	mockRepo.AssertExpectations(t)
}

func TestDeleteInvestment(t *testing.T) {
	mockRepo := &MockInvestmentRepository{}
	investmentService := NewInvesmentServices(mockRepo)

	ctx := context.Background()
	investment := utils.GetNewRandomInvestment()

	mockRepo.On("FindOne", ctx, investment.Id).Return(investment, nil)
	mockRepo.On("Delete", ctx, investment.Id).Return(nil)

	err := investmentService.Delete(ctx, investment.Id)

	assert.NoError(t, err, "Delete should not return an error")
	mockRepo.AssertExpectations(t)
}

func TestDeleteInvestment_NotFound(t *testing.T) {
	mockRepo := &MockInvestmentRepository{}
	investmentService := NewInvesmentServices(mockRepo)

	ctx := context.Background()
	investmentId := "non-existent-id"
	investment := utils.GetNewRandomInvestment()
	investment.Id = "different-id" // Simulate not found scenario

	mockRepo.On("FindOne", ctx, investmentId).Return(investment, nil)

	err := investmentService.Delete(ctx, investmentId)

	assert.Error(t, err, "Delete should return an error when investment not found")
	assert.Equal(t, errorhttp.ErrNotFound, err)
	mockRepo.AssertExpectations(t)
}

func TestDeleteInvestment_FindOneError(t *testing.T) {
	mockRepo := &MockInvestmentRepository{}
	investmentService := NewInvesmentServices(mockRepo)

	ctx := context.Background()
	investmentId := "test-id"

	mockRepo.On("FindOne", ctx, investmentId).Return((*invesment.Invesment)(nil), ErrRepositoryFailure)

	err := investmentService.Delete(ctx, investmentId)

	assert.Error(t, err, "Delete should return an error when FindOne fails")
	assert.Equal(t, ErrRepositoryFailure, err)
	mockRepo.AssertExpectations(t)
}

func TestDeleteInvestment_DeleteError(t *testing.T) {
	mockRepo := &MockInvestmentRepository{}
	investmentService := NewInvesmentServices(mockRepo)

	ctx := context.Background()
	investment := utils.GetNewRandomInvestment()

	mockRepo.On("FindOne", ctx, investment.Id).Return(investment, nil)
	mockRepo.On("Delete", ctx, investment.Id).Return(ErrRepositoryFailure)

	err := investmentService.Delete(ctx, investment.Id)

	assert.Error(t, err, "Delete should return an error when repository delete fails")
	assert.Equal(t, ErrRepositoryFailure, err)
	mockRepo.AssertExpectations(t)
}
