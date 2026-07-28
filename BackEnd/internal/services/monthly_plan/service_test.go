package monthly_plan

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"github.com/osmait/gestorDePresupuesto/internal/domain/monthly_plan"
	dto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/monthly_plan"
	"github.com/osmait/gestorDePresupuesto/internal/services/errorhttp"
)

type MockMonthlyPlanRepository struct {
	mock.Mock
}

func (m *MockMonthlyPlanRepository) Save(ctx context.Context, item *monthly_plan.MonthlyPlanItem) error {
	args := m.Called(ctx, item)
	return args.Error(0)
}

func (m *MockMonthlyPlanRepository) FindAllByUser(ctx context.Context, userID string) ([]*monthly_plan.MonthlyPlanItem, error) {
	args := m.Called(ctx, userID)
	return args.Get(0).([]*monthly_plan.MonthlyPlanItem), args.Error(1)
}

func (m *MockMonthlyPlanRepository) FindOne(ctx context.Context, id string, userID string) (*monthly_plan.MonthlyPlanItem, error) {
	args := m.Called(ctx, id, userID)
	item, _ := args.Get(0).(*monthly_plan.MonthlyPlanItem)
	return item, args.Error(1)
}

func (m *MockMonthlyPlanRepository) Update(ctx context.Context, item *monthly_plan.MonthlyPlanItem) (int64, error) {
	args := m.Called(ctx, item)
	return args.Get(0).(int64), args.Error(1)
}

func (m *MockMonthlyPlanRepository) SetActive(ctx context.Context, id string, userID string, isActive bool) (int64, error) {
	args := m.Called(ctx, id, userID, isActive)
	return args.Get(0).(int64), args.Error(1)
}

func (m *MockMonthlyPlanRepository) Delete(ctx context.Context, id string, userID string) (int64, error) {
	args := m.Called(ctx, id, userID)
	return args.Get(0).(int64), args.Error(1)
}

func (m *MockMonthlyPlanRepository) Totals(ctx context.Context, userID string, usdToDop float64) (*monthly_plan.Totals, error) {
	args := m.Called(ctx, userID, usdToDop)
	totals, _ := args.Get(0).(*monthly_plan.Totals)
	return totals, args.Error(1)
}

func fixedRate(rate float64) func(context.Context) (float64, error) {
	return func(context.Context) (float64, error) {
		return rate, nil
	}
}

func ptr[T any](value T) *T {
	return &value
}

func TestCreate(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name        string
		request     *dto.MonthlyPlanItemRequest
		wantActive  bool
		wantDay     *int
		wantCatNil  bool
		wantCurrncy string
	}{
		{
			name: "fixed expense with every optional field set",
			request: &dto.MonthlyPlanItemRequest{
				Name:       "Alquiler",
				Amount:     25000,
				Type:       monthly_plan.TypeBill,
				Currency:   monthly_plan.CurrencyDOP,
				CategoryID: ptr("cat-1"),
				DayOfMonth: ptr(1),
			},
			wantActive:  true,
			wantDay:     ptr(1),
			wantCurrncy: monthly_plan.CurrencyDOP,
		},
		{
			name: "empty currency defaults to DOP",
			request: &dto.MonthlyPlanItemRequest{
				Name:   "Salario",
				Amount: 85000,
				Type:   monthly_plan.TypeIncome,
			},
			wantActive:  true,
			wantCatNil:  true,
			wantCurrncy: monthly_plan.CurrencyDOP,
		},
		{
			name: "empty category id is stored as NULL, not as an empty key",
			request: &dto.MonthlyPlanItemRequest{
				Name:       "Netflix",
				Amount:     15,
				Type:       monthly_plan.TypeBill,
				Currency:   monthly_plan.CurrencyUSD,
				CategoryID: ptr(""),
				AccountID:  ptr(""),
			},
			wantActive:  true,
			wantCatNil:  true,
			wantCurrncy: monthly_plan.CurrencyUSD,
		},
		{
			name: "explicitly inactive item stays inactive",
			request: &dto.MonthlyPlanItemRequest{
				Name:     "Gym cancelado",
				Amount:   1500,
				Type:     monthly_plan.TypeBill,
				IsActive: ptr(false),
			},
			wantActive:  false,
			wantCatNil:  true,
			wantCurrncy: monthly_plan.CurrencyDOP,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			repo := &MockMonthlyPlanRepository{}
			service := NewMonthlyPlanService(repo, fixedRate(60))

			var saved *monthly_plan.MonthlyPlanItem
			repo.On("Save", mock.Anything, mock.Anything).Run(func(args mock.Arguments) {
				saved = args.Get(1).(*monthly_plan.MonthlyPlanItem)
			}).Return(nil)

			err := service.Create(context.Background(), tt.request, "user-1")

			assert.NoError(t, err)
			assert.NotEmpty(t, saved.ID, "service must generate an id")
			assert.Equal(t, "user-1", saved.UserID)
			assert.Equal(t, tt.wantActive, saved.IsActive)
			assert.Equal(t, tt.wantCurrncy, saved.Currency)
			assert.Equal(t, tt.wantDay, saved.DayOfMonth)
			if tt.wantCatNil {
				assert.Nil(t, saved.CategoryID)
			} else {
				assert.NotNil(t, saved.CategoryID)
			}
		})
	}
}

func TestCreatePropagatesRepositoryError(t *testing.T) {
	t.Parallel()

	repo := &MockMonthlyPlanRepository{}
	service := NewMonthlyPlanService(repo, fixedRate(60))

	repoErr := errors.New("db down")
	repo.On("Save", mock.Anything, mock.Anything).Return(repoErr)

	err := service.Create(context.Background(), &dto.MonthlyPlanItemRequest{
		Name:   "Alquiler",
		Amount: 25000,
		Type:   monthly_plan.TypeBill,
	}, "user-1")

	assert.ErrorIs(t, err, repoErr)
}

func TestFindAllByUserConvertsUsdToDop(t *testing.T) {
	t.Parallel()

	repo := &MockMonthlyPlanRepository{}
	service := NewMonthlyPlanService(repo, fixedRate(62.5))

	items := []*monthly_plan.MonthlyPlanItem{
		{ID: "1", Name: "Alquiler", Amount: 25000, Currency: monthly_plan.CurrencyDOP, Type: monthly_plan.TypeBill},
		{ID: "2", Name: "Netflix", Amount: 15, Currency: monthly_plan.CurrencyUSD, Type: monthly_plan.TypeBill},
	}
	repo.On("FindAllByUser", mock.Anything, "user-1").Return(items, nil)

	responses, err := service.FindAllByUser(context.Background(), "user-1")

	assert.NoError(t, err)
	assert.Len(t, responses, 2)
	// A DOP row is left untouched.
	assert.Equal(t, 25000.0, responses[0].Amount)
	assert.Equal(t, 25000.0, responses[0].AmountDop)
	// A USD row keeps its original amount and exposes the converted one.
	assert.Equal(t, 15.0, responses[1].Amount)
	assert.Equal(t, 937.5, responses[1].AmountDop)
}

func TestFindAllByUserReturnsEmptySliceNotNil(t *testing.T) {
	t.Parallel()

	repo := &MockMonthlyPlanRepository{}
	service := NewMonthlyPlanService(repo, fixedRate(60))

	repo.On("FindAllByUser", mock.Anything, "user-1").Return([]*monthly_plan.MonthlyPlanItem{}, nil)

	responses, err := service.FindAllByUser(context.Background(), "user-1")

	assert.NoError(t, err)
	assert.NotNil(t, responses, "an empty plan must serialize as [] and not as null")
	assert.Empty(t, responses)
}

func TestSummary(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name            string
		totals          *monthly_plan.Totals
		wantAvailable   float64
		wantCommittedPc float64
	}{
		{
			name:            "income above expenses leaves a positive balance",
			totals:          &monthly_plan.Totals{TotalIncome: 97000, TotalExpenses: 27790, IncomeCount: 2, ExpensesCount: 3},
			wantAvailable:   69210,
			wantCommittedPc: 28.649484536082475,
		},
		{
			name:            "expenses above income report a negative balance and over 100 percent committed",
			totals:          &monthly_plan.Totals{TotalIncome: 20000, TotalExpenses: 25000, IncomeCount: 1, ExpensesCount: 4},
			wantAvailable:   -5000,
			wantCommittedPc: 125,
		},
		{
			name:            "no income at all does not divide by zero",
			totals:          &monthly_plan.Totals{TotalIncome: 0, TotalExpenses: 5000, ExpensesCount: 2},
			wantAvailable:   -5000,
			wantCommittedPc: 0,
		},
		{
			name:            "an empty plan is all zeros",
			totals:          &monthly_plan.Totals{},
			wantAvailable:   0,
			wantCommittedPc: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			repo := &MockMonthlyPlanRepository{}
			service := NewMonthlyPlanService(repo, fixedRate(60))

			repo.On("Totals", mock.Anything, "user-1", 60.0).Return(tt.totals, nil)

			summary, err := service.Summary(context.Background(), "user-1")

			assert.NoError(t, err)
			assert.Equal(t, tt.totals.TotalIncome, summary.TotalIncome)
			assert.Equal(t, tt.totals.TotalExpenses, summary.TotalExpenses)
			assert.Equal(t, tt.wantAvailable, summary.Available)
			assert.InDelta(t, tt.wantCommittedPc, summary.CommittedPercentage, 0.0001)
			assert.Equal(t, 60.0, summary.UsdToDopRate)
			assert.Equal(t, tt.totals.IncomeCount, summary.IncomeCount)
			assert.Equal(t, tt.totals.ExpensesCount, summary.ExpensesCount)
		})
	}
}

func TestSummaryUsesFallbackRateWhenExchangeFails(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name   string
		rateFn func(context.Context) (float64, error)
	}{
		{
			name:   "no rate function configured",
			rateFn: nil,
		},
		{
			name: "exchange service returns an error",
			rateFn: func(context.Context) (float64, error) {
				return 0, errors.New("exchange unreachable")
			},
		},
		{
			name: "exchange service returns a non-positive rate",
			rateFn: func(context.Context) (float64, error) {
				return 0, nil
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			repo := &MockMonthlyPlanRepository{}
			service := NewMonthlyPlanService(repo, tt.rateFn)

			repo.On("Totals", mock.Anything, "user-1", fallbackUsdToDopRate).
				Return(&monthly_plan.Totals{TotalIncome: 1000}, nil)

			summary, err := service.Summary(context.Background(), "user-1")

			assert.NoError(t, err)
			assert.Equal(t, fallbackUsdToDopRate, summary.UsdToDopRate)
			repo.AssertExpectations(t)
		})
	}
}

func TestUpdate(t *testing.T) {
	t.Parallel()

	request := &dto.MonthlyPlanItemRequest{
		Name:   "Alquiler",
		Amount: 26000,
		Type:   monthly_plan.TypeBill,
	}

	t.Run("updates an owned item", func(t *testing.T) {
		t.Parallel()

		repo := &MockMonthlyPlanRepository{}
		service := NewMonthlyPlanService(repo, fixedRate(60))
		repo.On("Update", mock.Anything, mock.Anything).Return(int64(1), nil)

		err := service.Update(context.Background(), request, "item-1", "user-1")

		assert.NoError(t, err)
	})

	t.Run("returns not found when the item belongs to another user", func(t *testing.T) {
		t.Parallel()

		repo := &MockMonthlyPlanRepository{}
		service := NewMonthlyPlanService(repo, fixedRate(60))
		// The UPDATE is scoped by user id, so someone else's item affects no rows.
		repo.On("Update", mock.Anything, mock.Anything).Return(int64(0), nil)

		err := service.Update(context.Background(), request, "item-1", "attacker")

		assert.ErrorIs(t, err, errorhttp.ErrNotFound)
	})

	t.Run("scopes the update to the caller", func(t *testing.T) {
		t.Parallel()

		repo := &MockMonthlyPlanRepository{}
		service := NewMonthlyPlanService(repo, fixedRate(60))

		var updated *monthly_plan.MonthlyPlanItem
		repo.On("Update", mock.Anything, mock.Anything).Run(func(args mock.Arguments) {
			updated = args.Get(1).(*monthly_plan.MonthlyPlanItem)
		}).Return(int64(1), nil)

		err := service.Update(context.Background(), request, "item-1", "user-1")

		assert.NoError(t, err)
		assert.Equal(t, "item-1", updated.ID)
		assert.Equal(t, "user-1", updated.UserID)
	})
}

func TestSetActive(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name         string
		rowsAffected int64
		wantErr      error
	}{
		{name: "pauses an owned item", rowsAffected: 1, wantErr: nil},
		{name: "unknown item is not found", rowsAffected: 0, wantErr: errorhttp.ErrNotFound},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			repo := &MockMonthlyPlanRepository{}
			service := NewMonthlyPlanService(repo, fixedRate(60))
			repo.On("SetActive", mock.Anything, "item-1", "user-1", false).Return(tt.rowsAffected, nil)

			err := service.SetActive(context.Background(), "item-1", "user-1", false)

			if tt.wantErr != nil {
				assert.ErrorIs(t, err, tt.wantErr)
				return
			}
			assert.NoError(t, err)
		})
	}
}

func TestDelete(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name         string
		rowsAffected int64
		repoErr      error
		wantErr      error
	}{
		{name: "deletes an owned item", rowsAffected: 1},
		{name: "unknown item is not found", rowsAffected: 0, wantErr: errorhttp.ErrNotFound},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			repo := &MockMonthlyPlanRepository{}
			service := NewMonthlyPlanService(repo, fixedRate(60))
			repo.On("Delete", mock.Anything, "item-1", "user-1").Return(tt.rowsAffected, tt.repoErr)

			err := service.Delete(context.Background(), "item-1", "user-1")

			if tt.wantErr != nil {
				assert.ErrorIs(t, err, tt.wantErr)
				return
			}
			assert.NoError(t, err)
		})
	}
}

func TestCommittedPercentage(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name     string
		income   float64
		expenses float64
		want     float64
	}{
		{name: "half the income is committed", income: 100, expenses: 50, want: 50},
		{name: "everything is committed", income: 100, expenses: 100, want: 100},
		{name: "overcommitted goes above 100", income: 100, expenses: 150, want: 150},
		{name: "zero income guards the division", income: 0, expenses: 50, want: 0},
		{name: "negative income guards the division", income: -10, expenses: 50, want: 0},
		{name: "no expenses means nothing committed", income: 100, expenses: 0, want: 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			assert.InDelta(t, tt.want, committedPercentage(tt.income, tt.expenses), 0.0001)
		})
	}
}

func TestNormalizeOptionalID(t *testing.T) {
	t.Parallel()

	assert.Nil(t, normalizeOptionalID(nil), "nil stays nil")
	assert.Nil(t, normalizeOptionalID(ptr("")), "an empty string becomes NULL")
	assert.Equal(t, "cat-1", *normalizeOptionalID(ptr("cat-1")), "a real id is preserved")
}
