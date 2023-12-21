package postgress

import (
	"context"

	"github.com/osmait/gestorDePresupuesto/src/internals/domain/account"
)

type AccountRepositoryInterface interface {
	Save(ctx context.Context, account *account.Account) error
	FindAll(ctx context.Context, userId string) ([]*account.Account, error)
	Delete(ctx context.Context, id string) error
	Balance(ctx context.Context, id string) (float64, error)
}
