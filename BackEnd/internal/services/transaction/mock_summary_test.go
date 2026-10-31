package transaction

import (
	"context"
	"testing"
	"time"

	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
	"github.com/osmait/gestorDePresupuesto/internal/domain/transaction"
	"github.com/osmait/gestorDePresupuesto/internal/platform/cache"
	dto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/transaction"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func (m *MockTransaction) SummarizeWithFilters(ctx context.Context, userId string, filter *dto.TransactionFilter) ([]dto.SummaryGroup, error) {
	args := m.Called(ctx, userId, filter)
	groups, _ := args.Get(0).([]dto.SummaryGroup)
	return groups, args.Error(1)
}

func (m *MockTransaction) FindCategorizedHistory(ctx context.Context, userId string, since time.Time, limit int) ([]*transaction.Transaction, error) {
	args := m.Called(ctx, userId, since, limit)
	txs, _ := args.Get(0).([]*transaction.Transaction)
	return txs, args.Error(1)
}

// include_summary aggregates in SQL: the service never loads every matching
// row (no unpaginated FindAllOfAllAccountsWithFilters call).
func TestFindAllOfAllAccountsWithFilters_SummaryIsAggregatedInSQL(t *testing.T) {
	mockRepo := &MockTransaction{}
	s := NewTransactionService(mockRepo, &MockBudgetRepository{}, nil, cache.NewInMemoryCache(time.Minute, time.Minute), nil,
		func(context.Context) (money.Amount, error) { return money.FromInt(60), nil })

	page := []*transaction.Transaction{{Id: "t1", Name: "n", Amount: money.FromInt(5), TypeTransation: "bill", CreatedAt: time.Now()}}
	mockRepo.On("CountWithFilters", mock.Anything, "u1", mock.Anything).Return(int64(3), nil)
	mockRepo.On("FindAllOfAllAccountsWithFilters", mock.Anything, "u1", mock.Anything).Return(page, nil).Once()
	mockRepo.On("SummarizeWithFilters", mock.Anything, "u1", mock.Anything).Return([]dto.SummaryGroup{
		{TypeTransation: "bill", Currency: "DOP", CategoryId: "c1", Total: money.FromInt(15), Count: 2, Max: money.FromInt(10)},
		{TypeTransation: "income", Currency: "USD", CategoryId: "c2", Total: money.FromInt(2), Count: 1, Max: money.FromInt(2)},
	}, nil)

	filter := dto.NewTransactionFilter()
	filter.Limit = 1
	res, err := s.FindAllOfAllAccountsWithFilters(context.Background(), "u1", filter, true)
	require.NoError(t, err)
	resp, ok := res.(*dto.PaginatedTransactionResponseWithSummary)
	require.True(t, ok)
	assert.True(t, resp.Summary.TotalExpenses.Equal(money.FromInt(15)))
	assert.True(t, resp.Summary.TotalIncome.Equal(money.FromInt(120)))
	assert.Equal(t, 2, resp.Summary.ExpenseCount)
	assert.Equal(t, 1, resp.Summary.IncomeCount)
	mockRepo.AssertNumberOfCalls(t, "FindAllOfAllAccountsWithFilters", 1)
}
