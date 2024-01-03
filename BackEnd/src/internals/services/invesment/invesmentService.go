package invesment

import (
	"context"

	"github.com/osmait/gestorDePresupuesto/src/internals/domain/invesment"
	"github.com/osmait/gestorDePresupuesto/src/internals/platform/storage/postgress"
	"github.com/osmait/gestorDePresupuesto/src/internals/services/errorhttp"
)

type InvesmentServices struct {
	repo postgress.InvesmentRepoInterface
}

func NewInvesmentServices(repo postgress.InvesmentRepoInterface) *InvesmentServices {
	return &InvesmentServices{
		repo: repo,
	}
}

func (i *InvesmentServices) CreateInvesment(ctx context.Context, invesment *invesment.Invesment) error {
	err := i.repo.Save(ctx, invesment)
	return err
}

func (i *InvesmentServices) FindAll(ctx context.Context, userId string) ([]*invesment.Invesment, error) {
	invesments, err := i.repo.FindAll(ctx, userId)
	if err != nil {
		return nil, err
	}
	return invesments, nil
}

func (i *InvesmentServices) Delete(ctx context.Context, id string) error {
	invesment, err := i.repo.FindOne(ctx, id)
	if err != nil {
		return err
	}
	if invesment.Id != id {
		return errorhttp.ErrNotFound
	}
	err = i.repo.Delete(ctx, id)
	return err
}
