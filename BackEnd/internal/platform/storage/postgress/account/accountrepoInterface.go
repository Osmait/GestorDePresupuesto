package postgress

import (
	"context"

	"github.com/osmait/gestorDePresupuesto/internal/domain/account"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
)

// AccountRepositoryInterface persists accounts. Every method is scoped to the
// owning user; accounts of other users are reported as not found.
type AccountRepositoryInterface interface {
	Save(ctx context.Context, account *account.Account) error
	FindAll(ctx context.Context, userId string) ([]*account.Account, error)
	Delete(ctx context.Context, id string, userId string) error
	Balance(ctx context.Context, id string, userId string) (money.Amount, error)
	BalanceByCurrency(ctx context.Context, id string, userId string, currency string) (money.Amount, error)
	Balances(ctx context.Context, userId string) (map[string]money.Amount, error)
	Update(ctx context.Context, id string, name string, bank string, userId string) error
	FindByIdAndUserId(ctx context.Context, id string, userId string) (*account.Account, error)
	FindByIdAndUserIdForUpdate(ctx context.Context, id string, userId string) (*account.Account, error)
	Search(ctx context.Context, userId string, query string) ([]*account.Account, error)
}
