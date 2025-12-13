package postgress

import (
	"context"

	"github.com/osmait/gestorDePresupuesto/internal/domain/transaction"
	dto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/transaction"
)

type TransactionRepositoryInterface interface {
	Save(ctx context.Context, transaction *transaction.Transaction) error
	FindAll(ctx context.Context, date1 string, date2 string, id string) ([]*transaction.Transaction, error)
	FindCurrentBudget(ctx context.Context, budgetId string) (float64, error)
	FindCurrentBudgets(ctx context.Context, userId string) (map[string]float64, error)
	FindAllOfAllAccounts(ctx context.Context, id string) ([]*transaction.Transaction, error)
	Delete(ctx context.Context, id string, userId string) error

	// New methods for filtering and pagination
	FindAllOfAllAccountsWithFilters(ctx context.Context, userId string, filter *dto.TransactionFilter) ([]*transaction.Transaction, error)
	FindAllWithFilters(ctx context.Context, filter *dto.TransactionFilter) ([]*transaction.Transaction, error)
	CountWithFilters(ctx context.Context, userId string, filter *dto.TransactionFilter) (int64, error)
}
