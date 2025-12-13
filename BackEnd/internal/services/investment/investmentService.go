package investment

import (
	"context"

	"github.com/osmait/gestorDePresupuesto/internal/domain/investment"
	investmentRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/investment"
	"github.com/osmait/gestorDePresupuesto/internal/services/errorhttp"
)

type InvestmentServices struct {
	repo investmentRepo.InvestmentRepoInterface
}

func NewInvestmentServices(repo investmentRepo.InvestmentRepoInterface) *InvestmentServices {
	return &InvestmentServices{
		repo: repo,
	}
}

func (i *InvestmentServices) CreateInvestment(ctx context.Context, investment *investment.Investment) error {
	err := i.repo.Save(ctx, investment)
	return err
}

func (i *InvestmentServices) FindAll(ctx context.Context, userId string) ([]*investment.Investment, error) {
	investments, err := i.repo.FindAll(ctx, userId)
	if err != nil {
		return nil, err
	}
	return investments, nil
}

func (i *InvestmentServices) Delete(ctx context.Context, id string) error {
	investment, err := i.repo.FindOne(ctx, id)
	if err != nil {
		return err
	}
	if investment.Id != id {
		return errorhttp.ErrNotFound
	}
	err = i.repo.Delete(ctx, id)
	return err
}
