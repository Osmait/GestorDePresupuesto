package budget

import (
	"context"
	"time"

	"github.com/osmait/gestorDePresupuesto/internal/domain/transaction"
	transactionDto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/transaction"
)

func (m *MockTransaction) SummarizeWithFilters(ctx context.Context, userId string, filter *transactionDto.TransactionFilter) ([]transactionDto.SummaryGroup, error) {
	args := m.Called(ctx, userId, filter)
	groups, _ := args.Get(0).([]transactionDto.SummaryGroup)
	return groups, args.Error(1)
}

func (m *MockTransaction) FindCategorizedHistory(ctx context.Context, userId string, since time.Time, limit int) ([]*transaction.Transaction, error) {
	args := m.Called(ctx, userId, since, limit)
	txs, _ := args.Get(0).([]*transaction.Transaction)
	return txs, args.Error(1)
}
