package postgress

import (
	"context"
	"time"

	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
	"github.com/osmait/gestorDePresupuesto/internal/domain/transaction"
	dto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/transaction"
)

// TransactionRepositoryInterface persists transactions. Every read and write is
// scoped to the owning user: rows of other users are reported as not found and
// references (account, category, budget) to other users' rows are rejected.
type TransactionRepositoryInterface interface {
	Save(ctx context.Context, transaction *transaction.Transaction) error
	ResolveAndValidateCurrencyForAccount(ctx context.Context, userId string, accountId string, currency string) (string, error)
	FindAll(ctx context.Context, date1 string, date2 string, id string, userId string) ([]*transaction.Transaction, error)
	FindCurrentBudget(ctx context.Context, budgetId string, userId string, usdToDop money.Amount) (money.Amount, error)
	FindCurrentBudgets(ctx context.Context, userId string, usdToDop money.Amount) (map[string]money.Amount, error)
	FindAllOfAllAccounts(ctx context.Context, id string) ([]*transaction.Transaction, error)
	BalanceByAccountAndCurrency(ctx context.Context, accountId string, userId string, currency string) (money.Amount, error)
	Delete(ctx context.Context, id string, userId string) error
	// TypeOf returns the type of transaction id owned by userId
	// (ownership.ErrNotFound otherwise).
	TypeOf(ctx context.Context, id string, userId string) (string, error)
	Update(ctx context.Context, id string, transaction *transaction.Transaction) error
	FindAllOfAllAccountsWithFilters(ctx context.Context, userId string, filter *dto.TransactionFilter) ([]*transaction.Transaction, error)
	FindAllWithFilters(ctx context.Context, userId string, filter *dto.TransactionFilter) ([]*transaction.Transaction, error)
	CountWithFilters(ctx context.Context, userId string, filter *dto.TransactionFilter) (int64, error)
	FindByUserAndDateRange(ctx context.Context, userId string, dateFrom time.Time, dateTo time.Time) ([]*transaction.Transaction, error)
}
