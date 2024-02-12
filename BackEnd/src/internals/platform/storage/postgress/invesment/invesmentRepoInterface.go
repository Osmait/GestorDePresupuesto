package postgress

import (
	"context"

	"github.com/osmait/gestorDePresupuesto/src/internals/domain/invesment"
)

type InvesmentRepoInterface interface {
	Save(ctx context.Context, invesment *invesment.Invesment) error
	FindAll(ctx context.Context, userId string) ([]*invesment.Invesment, error)
	FindOne(ctx context.Context, id string) (*invesment.Invesment, error)
	Delete(ctx context.Context, id string) error
}
