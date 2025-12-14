package investment

import (
	"context"
	"sync"
	"time"

	"github.com/osmait/gestorDePresupuesto/internal/domain/investment"
	"github.com/osmait/gestorDePresupuesto/internal/services/quote"
	"github.com/segmentio/ksuid"
)

type InvestmentService struct {
	repo         investment.InvestmentRepository
	quoteService *quote.QuoteService
}

func NewInvestmentService(repo investment.InvestmentRepository, quoteService *quote.QuoteService) *InvestmentService {
	return &InvestmentService{repo: repo, quoteService: quoteService}
}

func (s *InvestmentService) Create(ctx context.Context, id, userId string, investmentType investment.InvestmentType, name, symbol string, quantity, purchasePrice, currentPrice float64) error {
	if id == "" {
		id = ksuid.New().String()
	}
	inv := investment.NewInvestment(id, userId, investmentType, name, symbol, quantity, purchasePrice, currentPrice)
	return s.repo.Save(ctx, inv)
}

func (s *InvestmentService) FindAll(ctx context.Context, userId string) ([]*investment.Investment, error) {
	investments, err := s.repo.FindAll(ctx, userId)
	if err != nil {
		return nil, err
	}

	// Determine which investments need updating
	var wg sync.WaitGroup
	var mu sync.Mutex

	for _, inv := range investments {
		// Update if older than 5 minutes or price is 0 (initial)
		if time.Since(inv.UpdatedAt) > 5*time.Minute || inv.CurrentPrice == 0 {
			wg.Add(1)
			go func(i *investment.Investment) {
				defer wg.Done()

				price, _, _, err := s.quoteService.GetQuote(i.Symbol)
				if err == nil && price > 0 {
					i.CurrentPrice = price
					i.UpdatedAt = time.Now()

					// Update in DB (ignore error to not block read)
					_ = s.repo.Update(context.Background(), i)

					mu.Lock()
					// Update the instance in the list (pointer)
					// (already updated via pointer i)
					mu.Unlock()
				}
			}(inv)
		}
	}

	// Wait for updates to finish (or use channel with timeout if strict latency needed)
	// For now, waiting is fine as it ensures user sees latest data
	done := make(chan struct{})
	go func() {
		wg.Wait()
		close(done)
	}()

	select {
	case <-done:
		// All updates finished
	case <-time.After(2 * time.Second):
		// Timeout after 2 seconds, return what we have
	}

	return investments, nil
}

func (s *InvestmentService) Update(ctx context.Context, inv *investment.Investment) error {
	inv.UpdatedAt = time.Now()
	return s.repo.Update(ctx, inv)
}

func (s *InvestmentService) Delete(ctx context.Context, id string) error {
	return s.repo.Delete(ctx, id)
}
