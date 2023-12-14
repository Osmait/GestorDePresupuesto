package postgress

import (
	"context"

	"github.com/osmait/gestorDePresupuesto/src/internals/domain/user"
)

type UserRepositoryInterface interface {
	FindUser(ctx context.Context, id string) (*user.User, error)
	CreateUser(ctx context.Context, user *user.User) error
	Delete(ctx context.Context, id string) error
}
