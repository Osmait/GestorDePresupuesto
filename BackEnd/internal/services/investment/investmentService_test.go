package investment

import (
	"context"
	"errors"
	"testing"

	domainInvestment "github.com/osmait/gestorDePresupuesto/internal/domain/investment"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money"

	"github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/ownership"
	"github.com/osmait/gestorDePresupuesto/internal/platform/utils"
	"github.com/osmait/gestorDePresupuesto/internal/services/errorhttp"
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

func (m *MockInvestmentRepository) FindByID(ctx context.Context, id string, userId string) (*domainInvestment.Investment, error) {
	args := m.Called(ctx, id, userId)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domainInvestment.Investment), args.Error(1)
}

func (m *MockInvestmentRepository) FindByIDForUpdate(ctx context.Context, id string, userId string) (*domainInvestment.Investment, error) {
	args := m.Called(ctx, id, userId)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*domainInvestment.Investment), args.Error(1)
}

func (m *MockInvestmentRepository) UpdateCurrentPrice(ctx context.Context, id string, userId string, price money.Amount) error {
	args := m.Called(ctx, id, userId, price)
	return args.Error(0)
}

func (m *MockInvestmentRepository) Update(ctx context.Context, investment *domainInvestment.Investment) error {
	args := m.Called(ctx, investment)
	return args.Error(0)
}

func (m *MockInvestmentRepository) Delete(ctx context.Context, id string, userId string) error {
	args := m.Called(ctx, id, userId)
	return args.Error(0)
}

func (m *MockInvestmentRepository) GetFundingBalances(ctx context.Context, userId string) ([]*domainInvestment.FundingBalance, error) {
	args := m.Called(ctx, userId)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*domainInvestment.FundingBalance), args.Error(1)
}

func (m *MockInvestmentRepository) AddFunding(ctx context.Context, movement *domainInvestment.FundingMovement) error {
	args := m.Called(ctx, movement)
	return args.Error(0)
}

func (m *MockInvestmentRepository) ConsumeFundingForInvestment(ctx context.Context, inv *domainInvestment.Investment, currency string, requiredAmount money.Amount) error {
	args := m.Called(ctx, inv, currency, requiredAmount)
	return args.Error(0)
}

func TestCreateInvestment(t *testing.T) {
	mockRepo := &MockInvestmentRepository{}
	investmentService := NewInvestmentService(mockRepo, nil, nil, nil, nil)

	ctx := context.Background()
	investment := utils.GetNewRandomInvestment()
	requiredAmount := investment.Quantity.Mul(investment.PurchasePrice)

	mockRepo.On("ConsumeFundingForInvestment", ctx, mock.MatchedBy(func(inv *domainInvestment.Investment) bool {
		return inv.ID == investment.ID &&
			inv.UserID == investment.UserID &&
			inv.Name == investment.Name &&
			inv.Symbol == investment.Symbol &&
			inv.Quantity.Equal(investment.Quantity) &&
			inv.PurchasePrice.Equal(investment.PurchasePrice) &&
			inv.CurrentPrice.Equal(investment.CurrentPrice)
	}), "USD", mock.MatchedBy(func(a money.Amount) bool { return a.Equal(requiredAmount) })).Return(nil)

	err := investmentService.Create(ctx, investment.ID, investment.UserID, "stock", investment.Name, investment.Symbol, investment.Quantity, investment.PurchasePrice, investment.CurrentPrice, "USD")

	assert.NoError(t, err, "CreateInvestment should not return an error")
	mockRepo.AssertExpectations(t)
}

func TestCreateInvestment_RepositoryError(t *testing.T) {
	mockRepo := &MockInvestmentRepository{}
	investmentService := NewInvestmentService(mockRepo, nil, nil, nil, nil)

	ctx := context.Background()
	investment := utils.GetNewRandomInvestment()
	requiredAmount := investment.Quantity.Mul(investment.PurchasePrice)

	mockRepo.On("ConsumeFundingForInvestment", ctx, mock.MatchedBy(func(inv *domainInvestment.Investment) bool {
		return inv.ID == investment.ID
	}), "USD", mock.MatchedBy(func(a money.Amount) bool { return a.Equal(requiredAmount) })).Return(ErrRepositoryFailure)

	err := investmentService.Create(ctx, investment.ID, investment.UserID, "stock", investment.Name, investment.Symbol, investment.Quantity, investment.PurchasePrice, investment.CurrentPrice, "USD")

	assert.Error(t, err, "CreateInvestment should return an error when repository fails")
	assert.Equal(t, ErrRepositoryFailure, err)
	mockRepo.AssertExpectations(t)
}

func TestFindAllInvestments(t *testing.T) {
	mockRepo := &MockInvestmentRepository{}
	investmentService := NewInvestmentService(mockRepo, nil, nil, nil, nil)

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
	investmentService := NewInvestmentService(mockRepo, nil, nil, nil, nil)

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
	investmentService := NewInvestmentService(mockRepo, nil, nil, nil, nil)

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
	investmentService := NewInvestmentService(mockRepo, nil, nil, nil, nil)

	ctx := context.Background()
	investment := utils.GetNewRandomInvestment()

	mockRepo.On("Delete", ctx, investment.ID, investment.UserID).Return(nil)

	err := investmentService.Delete(ctx, investment.ID, investment.UserID)

	assert.NoError(t, err, "Delete should not return an error")
	mockRepo.AssertExpectations(t)
}

func TestDeleteInvestment_RepositoryError(t *testing.T) {
	mockRepo := &MockInvestmentRepository{}
	investmentService := NewInvestmentService(mockRepo, nil, nil, nil, nil)

	ctx := context.Background()
	investmentId := "test-id"

	mockRepo.On("Delete", ctx, investmentId, "user-1").Return(ErrRepositoryFailure)

	err := investmentService.Delete(ctx, investmentId, "user-1")

	assert.Error(t, err, "Delete should return an error when repository fails")
	assert.Equal(t, ErrRepositoryFailure, err)
	mockRepo.AssertExpectations(t)
}

func TestUpdateInvestment_Ownership(t *testing.T) {
	t.Parallel()

	newName := "Renamed"
	newQuantity := money.MustParse("7.5")

	tests := []struct {
		name        string
		findResult  *domainInvestment.Investment
		findErr     error
		expectSave  bool
		expectedErr error
	}{
		{
			name:        "investment of another user is reported as not found and never written",
			findResult:  nil,
			findErr:     ownership.ErrNotFound,
			expectSave:  false,
			expectedErr: errorhttp.ErrNotFound,
		},
		{
			name: "owned investment only changes the editable fields",
			findResult: &domainInvestment.Investment{
				ID:              "inv-1",
				UserID:          "user-a",
				Name:            "Original",
				Symbol:          "AAPL",
				Quantity:        money.FromInt(1),
				SourceAccountID: "acc-a",
				SourceAmount:    money.FromInt(100),
			},
			expectSave: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			mockRepo := &MockInvestmentRepository{}
			investmentService := NewInvestmentService(mockRepo, nil, nil, nil, nil)
			ctx := context.Background()

			mockRepo.On("FindByIDForUpdate", ctx, "inv-1", "user-a").Return(tt.findResult, tt.findErr)
			if tt.expectSave {
				mockRepo.On("Update", ctx, mock.MatchedBy(func(inv *domainInvestment.Investment) bool {
					return inv.ID == "inv-1" &&
						inv.UserID == "user-a" &&
						inv.Name == newName &&
						inv.Quantity.Equal(newQuantity) &&
						inv.Symbol == "AAPL" &&
						inv.SourceAccountID == "acc-a" &&
						inv.SourceAmount.Equal(money.FromInt(100))
				})).Return(nil)
			}

			updated, err := investmentService.Update(ctx, "inv-1", "user-a", UpdateInput{Name: &newName, Quantity: &newQuantity})

			if tt.expectedErr != nil {
				assert.ErrorIs(t, err, tt.expectedErr)
				assert.Nil(t, updated)
				mockRepo.AssertNotCalled(t, "Update", mock.Anything, mock.Anything)
			} else {
				assert.NoError(t, err)
				assert.Equal(t, "user-a", updated.UserID)
			}
			mockRepo.AssertExpectations(t)
		})
	}
}
