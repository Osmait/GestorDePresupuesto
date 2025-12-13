package postgress

import (
	"context"

	"github.com/osmait/gestorDePresupuesto/internal/domain/account"
)

type AccountRepositoryInterface interface {
	Save(ctx context.Context, account *account.Account) error
	FindAll(ctx context.Context, userId string) ([]*account.Account, error)
	Delete(ctx context.Context, id string, userId string) error
	Balance(ctx context.Context, id string) (float64, error)
	Balances(ctx context.Context, userId string) (map[string]float64, error)
	Update(ctx context.Context, id string, name string, bank string, userId string) error
	FindByIdAndUserId(ctx context.Context, id string, userId string) (*account.Account, error)
}
