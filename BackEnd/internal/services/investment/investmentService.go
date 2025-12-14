package investment

import (
	"context"

	"github.com/osmait/gestorDePresupuesto/internal/domain/investment"
)

type InvestmentService struct {
	repo investment.InvestmentRepository
}

func NewInvestmentService(repo investment.InvestmentRepository) *InvestmentService {
	return &InvestmentService{repo: repo}
}

func (s *InvestmentService) Create(ctx context.Context, id, userId string, investmentType investment.InvestmentType, name, symbol string, quantity, purchasePrice, currentPrice float64) error {
	inv := investment.NewInvestment(id, userId, investmentType, name, symbol, quantity, purchasePrice, currentPrice)
	return s.repo.Save(ctx, inv)
}

func (s *InvestmentService) FindAll(ctx context.Context, userId string) ([]*investment.Investment, error) {
	return s.repo.FindAll(ctx, userId)
}

func (s *InvestmentService) Update(ctx context.Context, inv *investment.Investment) error {
	// Could add validaton logic here
	return s.repo.Update(ctx, inv)
}

func (s *InvestmentService) Delete(ctx context.Context, id string) error {
	return s.repo.Delete(ctx, id)
}
