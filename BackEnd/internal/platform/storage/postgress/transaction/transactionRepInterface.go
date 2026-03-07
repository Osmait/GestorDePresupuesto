package postgress

import (
	"context"
	"time"

	"github.com/osmait/gestorDePresupuesto/internal/domain/transaction"
	dto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/transaction"
)

type TransactionRepositoryInterface interface {
	Save(ctx context.Context, transaction *transaction.Transaction) error
	ResolveAndValidateCurrencyForAccount(ctx context.Context, userId string, accountId string, currency string) (string, error)
	FindAll(ctx context.Context, date1 string, date2 string, id string) ([]*transaction.Transaction, error)
	FindCurrentBudget(ctx context.Context, budgetId string, usdToDop float64) (float64, error)
	FindCurrentBudgets(ctx context.Context, userId string, usdToDop float64) (map[string]float64, error)
	FindAllOfAllAccounts(ctx context.Context, id string) ([]*transaction.Transaction, error)
	BalanceByAccountAndCurrency(ctx context.Context, accountId string, currency string) (float64, error)
	Delete(ctx context.Context, id string, userId string) error
	Update(ctx context.Context, id string, transaction *transaction.Transaction) error
	FindAllOfAllAccountsWithFilters(ctx context.Context, userId string, filter *dto.TransactionFilter) ([]*transaction.Transaction, error)
	FindAllWithFilters(ctx context.Context, filter *dto.TransactionFilter) ([]*transaction.Transaction, error)
	CountWithFilters(ctx context.Context, userId string, filter *dto.TransactionFilter) (int64, error)
	FindByUserAndDateRange(ctx context.Context, userId string, dateFrom time.Time, dateTo time.Time) ([]*transaction.Transaction, error)
}
