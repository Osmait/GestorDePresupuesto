package postgress

import (
	"context"

	"github.com/osmait/gestorDePresupuesto/internal/domain/investment"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
)

type InvestmentRepoInterface interface {
	Save(ctx context.Context, investment *investment.Investment) error
	FindAll(ctx context.Context, userId string) ([]*investment.Investment, error)
	FindByID(ctx context.Context, id string, userId string) (*investment.Investment, error)
	FindByIDForUpdate(ctx context.Context, id string, userId string) (*investment.Investment, error)
	UpdateCurrentPrice(ctx context.Context, id string, userId string, price money.Amount) error
	Update(ctx context.Context, investment *investment.Investment) error
	Delete(ctx context.Context, id string, userId string) error
	GetFundingBalances(ctx context.Context, userId string) ([]*investment.FundingBalance, error)
	AddFunding(ctx context.Context, movement *investment.FundingMovement) error
	ConsumeFundingForInvestment(ctx context.Context, inv *investment.Investment, currency string, requiredAmount money.Amount) error
	AdjustFundingForInvestment(ctx context.Context, userId, investmentID, currency string, delta money.Amount, description string) error
}
