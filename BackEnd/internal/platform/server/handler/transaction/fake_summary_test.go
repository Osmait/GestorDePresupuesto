package transaction

import (
	"context"
	"time"

	domain "github.com/osmait/gestorDePresupuesto/internal/domain/transaction"
	dto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/transaction"
)

func (f *fakeTxRepo) SummarizeWithFilters(context.Context, string, *dto.TransactionFilter) ([]dto.SummaryGroup, error) {
	groups := make([]dto.SummaryGroup, 0, len(f.page))
	for _, t := range f.page {
		groups = append(groups, dto.SummaryGroup{
			TypeTransation: t.TypeTransation, Currency: t.Currency, CategoryId: t.CategoryId,
			Total: t.Amount, Count: 1, Max: t.Amount,
		})
	}
	return groups, nil
}

func (f *fakeTxRepo) FindCategorizedHistory(context.Context, string, time.Time, int) ([]*domain.Transaction, error) {
	return f.page, nil
}
