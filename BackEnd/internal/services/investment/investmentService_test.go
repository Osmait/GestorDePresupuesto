package investment

import (
	"context"
	"errors"
	"testing"

	domainInvestment "github.com/osmait/gestorDePresupuesto/internal/domain/investment"

	"github.com/osmait/gestorDePresupuesto/internal/platform/utils"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

var (
	ErrRepositoryFailure = errors.New("repository failure")
)

type MockInvestmentRepository struct {
	mock.Mock
}

func (m *MockInvestmentRepository) Save(ctx context.Context, investment *domainInvestment.Investment) error {
	args := m.Called(ctx, investment)
	return args.Error(0)
}

func (m *MockInvestmentRepository) FindAll(ctx context.Context, userId string) ([]*domainInvestment.Investment, error) {
	args := m.Called(ctx, userId)
	return args.Get(0).([]*domainInvestment.Investment), args.Error(1)
}

func (m *MockInvestmentRepository) FindByID(ctx context.Context, id string) (*domainInvestment.Investment, error) {
	args := m.Called(ctx, id)
	return args.Get(0).(*domainInvestment.Investment), args.Error(1)
}

func (m *MockInvestmentRepository) Update(ctx context.Context, investment *domainInvestment.Investment) error {
	args := m.Called(ctx, investment)
	return args.Error(0)
}

func (m *MockInvestmentRepository) Delete(ctx context.Context, id string) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func TestCreateInvestment(t *testing.T) {
	mockRepo := &MockInvestmentRepository{}
	investmentService := NewInvestmentService(mockRepo, nil)

	ctx := context.Background()
	investment := utils.GetNewRandomInvestment()

	mockRepo.On("Save", ctx, mock.MatchedBy(func(inv *domainInvestment.Investment) bool {
		return inv.ID == investment.ID &&
			inv.UserID == investment.UserID &&
			inv.Name == investment.Name &&
			inv.Symbol == investment.Symbol &&
			inv.Quantity == investment.Quantity &&
			inv.PurchasePrice == investment.PurchasePrice &&
			inv.CurrentPrice == investment.CurrentPrice
	})).Return(nil)

	err := investmentService.Create(ctx, investment.ID, investment.UserID, "stock", investment.Name, investment.Symbol, investment.Quantity, investment.PurchasePrice, investment.CurrentPrice)

	assert.NoError(t, err, "CreateInvestment should not return an error")
	mockRepo.AssertExpectations(t)
}

func TestCreateInvestment_RepositoryError(t *testing.T) {
	mockRepo := &MockInvestmentRepository{}
	investmentService := NewInvestmentService(mockRepo, nil)

	ctx := context.Background()
	investment := utils.GetNewRandomInvestment()

	mockRepo.On("Save", ctx, mock.MatchedBy(func(inv *domainInvestment.Investment) bool {
		return inv.ID == investment.ID
	})).Return(ErrRepositoryFailure)

	err := investmentService.Create(ctx, investment.ID, investment.UserID, "stock", investment.Name, investment.Symbol, investment.Quantity, investment.PurchasePrice, investment.CurrentPrice)

	assert.Error(t, err, "CreateInvestment should return an error when repository fails")
	assert.Equal(t, ErrRepositoryFailure, err)
	mockRepo.AssertExpectations(t)
}

func TestFindAllInvestments(t *testing.T) {
	mockRepo := &MockInvestmentRepository{}
	investmentService := NewInvestmentService(mockRepo, nil)

	ctx := context.Background()
	userId := "test-user-id"
	expectedInvestments := []*domainInvestment.Investment{}
	for i := 0; i < 5; i++ {
		investment := utils.GetNewRandomInvestment()
		investment.UserID = userId
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
	investmentService := NewInvestmentService(mockRepo, nil)

	ctx := context.Background()
	userId := "test-user-id"
	expectedInvestments := []*domainInvestment.Investment{}

	mockRepo.On("FindAll", ctx, userId).Return(expectedInvestments, nil)

	result, err := investmentService.FindAll(ctx, userId)

	assert.NoError(t, err, "FindAll should not return an error for empty result")
	assert.Empty(t, result)
	mockRepo.AssertExpectations(t)
}

func TestFindAllInvestments_RepositoryError(t *testing.T) {
	mockRepo := &MockInvestmentRepository{}
	investmentService := NewInvestmentService(mockRepo, nil)

	ctx := context.Background()
	userId := "test-user-id"

	mockRepo.On("FindAll", ctx, userId).Return([]*domainInvestment.Investment(nil), ErrRepositoryFailure)

	result, err := investmentService.FindAll(ctx, userId)

	assert.Error(t, err, "FindAll should return an error when repository fails")
	assert.Nil(t, result)
	assert.Equal(t, ErrRepositoryFailure, err)
	mockRepo.AssertExpectations(t)
}

func TestDeleteInvestment(t *testing.T) {
	mockRepo := &MockInvestmentRepository{}
	investmentService := NewInvestmentService(mockRepo, nil)

	ctx := context.Background()
	investment := utils.GetNewRandomInvestment()

	mockRepo.On("Delete", ctx, investment.ID).Return(nil)

	err := investmentService.Delete(ctx, investment.ID)

	assert.NoError(t, err, "Delete should not return an error")
	mockRepo.AssertExpectations(t)
}

func TestDeleteInvestment_RepositoryError(t *testing.T) {
	mockRepo := &MockInvestmentRepository{}
	investmentService := NewInvestmentService(mockRepo, nil)

	ctx := context.Background()
	investmentId := "test-id"

	mockRepo.On("Delete", ctx, investmentId).Return(ErrRepositoryFailure)

	err := investmentService.Delete(ctx, investmentId)

	assert.Error(t, err, "Delete should return an error when repository fails")
	assert.Equal(t, ErrRepositoryFailure, err)
	mockRepo.AssertExpectations(t)
}
