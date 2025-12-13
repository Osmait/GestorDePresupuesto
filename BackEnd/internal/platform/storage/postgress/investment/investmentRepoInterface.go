package postgress

import (
	"context"

	"github.com/osmait/gestorDePresupuesto/internal/domain/investment"
)

type InvestmentRepoInterface interface {
	Save(ctx context.Context, investment *investment.Investment) error
	FindAll(ctx context.Context, userId string) ([]*investment.Investment, error)
	FindOne(ctx context.Context, id string) (*investment.Investment, error)
	Delete(ctx context.Context, id string) error
}
