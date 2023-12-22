package postgress

import (
	"context"

	"github.com/osmait/gestorDePresupuesto/src/internals/domain/user"
)

type UserRepositoryInterface interface {
	FindUserById(ctx context.Context, id string) (*user.User, error)
	FindUserByEmail(ctx context.Context, email string) (*user.User, error)
	Save(ctx context.Context, user *user.User) error
	Delete(ctx context.Context, id string) error
}
