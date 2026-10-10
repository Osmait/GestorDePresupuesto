package transaction

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
	"github.com/osmait/gestorDePresupuesto/internal/domain/transaction"
	"github.com/osmait/gestorDePresupuesto/internal/platform/cache"
	dto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/transaction"
)

// A cached list is served without touching the database (no COUNT(*)), and a
// write by the same user invalidates it; other users' lists stay cached.
func TestFindAllOfAllAccountsWithFilters_CacheBeforeCount(t *testing.T) {
	mockRepo := &MockTransaction{}
	mockAICache := &MockAICache{}
	mockAICache.On("InvalidateUserAnalysis", mock.Anything).Return()
	mockAICache.On("InvalidateUserExtractions", mock.Anything).Return()
	s := NewTransactionService(mockRepo, &MockBudgetRepository{}, nil, cache.NewInMemoryCache(time.Minute, time.Minute), mockAICache, nil)

	rows := []*transaction.Transaction{{Id: "t1", Name: "n", Amount: money.FromInt(5), CreatedAt: time.Now()}}
	mockRepo.On("CountWithFilters", mock.Anything, mock.Anything, mock.Anything).Return(int64(1), nil)
	mockRepo.On("FindAllOfAllAccountsWithFilters", mock.Anything, mock.Anything, mock.Anything).Return(rows, nil)
	mockRepo.On("Delete", mock.Anything, mock.Anything, mock.Anything).Return(nil)

	ctx := context.Background()
	list := func(user string) {
		_, err := s.FindAllOfAllAccountsWithFilters(ctx, user, dto.NewTransactionFilter(), false)
		require.NoError(t, err)
	}

	list("u1")
	list("u1")
	list("u2")
	list("u2")
	mockRepo.AssertNumberOfCalls(t, "CountWithFilters", 2)
	mockRepo.AssertNumberOfCalls(t, "FindAllOfAllAccountsWithFilters", 2)

	require.NoError(t, s.DeleteTransaction(ctx, "t1", "u1"))
	list("u1") // invalidated
	list("u2") // still cached
	mockRepo.AssertNumberOfCalls(t, "CountWithFilters", 3)
	mockRepo.AssertNumberOfCalls(t, "FindAllOfAllAccountsWithFilters", 3)
}
