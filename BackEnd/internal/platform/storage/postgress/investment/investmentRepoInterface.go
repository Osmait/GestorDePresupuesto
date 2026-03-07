package postgress

import (
	"context"

	"github.com/osmait/gestorDePresupuesto/internal/domain/investment"
)

type InvestmentRepoInterface interface {
	Save(ctx context.Context, investment *investment.Investment) error
	FindAll(ctx context.Context, userId string) ([]*investment.Investment, error)
	FindByID(ctx context.Context, id string) (*investment.Investment, error)
	Update(ctx context.Context, investment *investment.Investment) error
	Delete(ctx context.Context, id string) error
	GetFundingBalances(ctx context.Context, userId string) ([]*investment.FundingBalance, error)
	AddFunding(ctx context.Context, movement *investment.FundingMovement) error
	ConsumeFundingForInvestment(ctx context.Context, inv *investment.Investment, currency string, requiredAmount float64) error
}
