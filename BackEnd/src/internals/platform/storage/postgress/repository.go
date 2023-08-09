package postgress

import (
	"context"

	"github.com/osmait/gestorDePresupuesto/src/internals/domain/account"
)

type Repository interface {
	Save(ctx context.Context, account account.Account) error
	FindAll(ctx context.Context) ([]*account.Account, error)
	Delete(ctx context.Context, id string) error
}
