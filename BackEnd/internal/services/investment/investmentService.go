package investment

import (
	"context"
	"errors"
	"fmt"
	"math"
	"strings"
	"sync"
	"time"

	categoryDomain "github.com/osmait/gestorDePresupuesto/internal/domain/category"
	"github.com/osmait/gestorDePresupuesto/internal/domain/investment"
	accountRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/account"
	categoryRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/category"
	investmentRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/investment"
	"github.com/osmait/gestorDePresupuesto/internal/services/quote"
	"github.com/osmait/gestorDePresupuesto/internal/services/transaction"
	"github.com/segmentio/ksuid"
)

// InvestmentService handles business logic related to investment management.
type InvestmentService struct {
	repo               investment.InvestmentRepository
	quoteService       *quote.QuoteService
	transactionService *transaction.TransactionService
	accountRepository  accountRepo.AccountRepositoryInterface
	categoryRepository categoryRepo.CategoryRepoInterface
}

type FeeInput struct {
	Name       string
	Amount     float64
	CategoryID string
}

type FundingRequest struct {
	SourceAccountID string
	SourceAmount    float64
	SourceCurrency  string
	TargetCurrency  string
	ExchangeRate    float64
	FeeAmount       float64
	Notes           string
}

// NewInvestmentService creates a new instance of InvestmentService.
func NewInvestmentService(
	repo investment.InvestmentRepository,
	quoteService *quote.QuoteService,
	transactionService *transaction.TransactionService,
	accountRepository accountRepo.AccountRepositoryInterface,
	categoryRepository categoryRepo.CategoryRepoInterface,
) *InvestmentService {
	return &InvestmentService{
		repo:               repo,
		quoteService:       quoteService,
		transactionService: transactionService,
		accountRepository:  accountRepository,
		categoryRepository: categoryRepository,
	}
}

// Create records a new investment for a user.
func (s *InvestmentService) Create(ctx context.Context, id, userId string, investmentType investment.InvestmentType, name, symbol string, quantity, purchasePrice, currentPrice float64, settlementCurrency string) error {
	if id == "" {
		id = ksuid.New().String()
	}

	settlementCurrency = strings.ToUpper(strings.TrimSpace(settlementCurrency))
	if settlementCurrency == "" {
		settlementCurrency = "USD"
	}

	requiredAmount := math.Abs(quantity * purchasePrice)
	if requiredAmount <= 0 {
		return errors.New("investment amount must be greater than 0")
	}

	inv := investment.NewInvestment(id, userId, investmentType, name, symbol, quantity, purchasePrice, currentPrice)
	inv.SettlementCurrency = settlementCurrency
	inv.SourceAmount = requiredAmount

	err := s.repo.ConsumeFundingForInvestment(ctx, inv, settlementCurrency, requiredAmount)
	if err != nil {
		if errors.Is(err, investmentRepo.ErrInsufficientFunding) {
			return fmt.Errorf("insufficient broker funding in %s", settlementCurrency)
		}
		return err
	}

	return nil
}

func (s *InvestmentService) FundBroker(ctx context.Context, userID string, req FundingRequest) error {
	if s.transactionService == nil || s.accountRepository == nil || s.categoryRepository == nil {
		return errors.New("funding service is not available")
	}

	sourceAccountID := strings.TrimSpace(req.SourceAccountID)
	if sourceAccountID == "" {
		return errors.New("source_account_id is required")
	}
	sourceAmount := math.Abs(req.SourceAmount)
	if sourceAmount <= 0 {
		return errors.New("source_amount must be greater than 0")
	}

	account, err := s.accountRepository.FindByIdAndUserId(ctx, sourceAccountID, userID)
	if err != nil {
		return errors.New("source account not found")
	}

	sourceCurrency := strings.ToUpper(strings.TrimSpace(account.Currency))
	if sourceCurrency == "" {
		sourceCurrency = "DOP"
	}

	targetCurrency := strings.ToUpper(strings.TrimSpace(req.TargetCurrency))
	if targetCurrency == "" {
		targetCurrency = sourceCurrency
	}

	feeAmount := math.Abs(req.FeeAmount)
	creditedTargetAmount := sourceAmount
	if sourceCurrency != targetCurrency {
		if req.ExchangeRate <= 0 {
			return fmt.Errorf("exchange_rate is required when converting %s to %s", sourceCurrency, targetCurrency)
		}
		creditedTargetAmount = sourceAmount / req.ExchangeRate
	}

	fundingCategoryID, err := s.ensureSystemCategory(ctx, userID, "Fondeo broker", "🏦", "#2563eb")
	if err != nil {
		return err
	}

	txName := "Transfer to broker"
	txDescription := "Investment wallet funding"
	if sourceCurrency != targetCurrency {
		txDescription = fmt.Sprintf("Funding broker converted from %s to %s at rate %.6f", sourceCurrency, targetCurrency, req.ExchangeRate)
	}

	if err := s.transactionService.CreateTransaction(
		ctx,
		txName,
		txDescription,
		sourceAmount,
		transaction.INVESTMENT_FUNDING,
		sourceAccountID,
		userID,
		fundingCategoryID,
		"",
		sourceCurrency,
		time.Now(),
	); err != nil {
		return err
	}

	movementID, _ := ksuid.NewRandom()
	if err := s.repo.AddFunding(ctx, &investment.FundingMovement{
		ID:              movementID.String(),
		UserID:          userID,
		Currency:        targetCurrency,
		Amount:          creditedTargetAmount,
		MovementType:    "deposit",
		Description:     strings.TrimSpace(req.Notes),
		ReferenceType:   "account_transfer",
		ReferenceID:     sourceAccountID,
		CounterCurrency: sourceCurrency,
		CounterAmount:   sourceAmount,
		ExchangeRate:    req.ExchangeRate,
		CreatedAt:       time.Now(),
	}); err != nil {
		return err
	}

	if feeAmount <= 0 {
		return nil
	}

	feeCategoryID, err := s.ensureSystemCategory(ctx, userID, "Comisiones de inversion", "💳", "#f97316")
	if err != nil {
		return err
	}

	return s.transactionService.CreateTransaction(
		ctx,
		"Broker funding fee",
		"Bank/FX fee for broker funding",
		feeAmount,
		transaction.BILL,
		sourceAccountID,
		userID,
		feeCategoryID,
		"",
		sourceCurrency,
		time.Now(),
	)
}

func (s *InvestmentService) GetFundingBalances(ctx context.Context, userID string) ([]*investment.FundingBalance, error) {
	return s.repo.GetFundingBalances(ctx, userID)
}

// FindAll retrieves all investments for a user, automatically updating quotes if stale.
func (s *InvestmentService) FindAll(ctx context.Context, userId string) ([]*investment.Investment, error) {
	investments, err := s.repo.FindAll(ctx, userId)
	if err != nil {
		return nil, err
	}

	// Determine which investments need updating
	var wg sync.WaitGroup

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

					// Update the instance in the list (pointer)
					// (already updated via pointer i)
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

// Update modifies an existing investment.
func (s *InvestmentService) Update(ctx context.Context, inv *investment.Investment) error {
	inv.UpdatedAt = time.Now()
	return s.repo.Update(ctx, inv)
}

// Delete removes an investment by its ID.
func (s *InvestmentService) Delete(ctx context.Context, id string) error {
	return s.repo.Delete(ctx, id)
}

func (s *InvestmentService) ensureSystemCategory(ctx context.Context, userId string, name string, icon string, color string) (string, error) {
	categories, err := s.categoryRepository.FindAll(ctx, userId)
	if err != nil {
		return "", err
	}

	for _, category := range categories {
		if strings.EqualFold(strings.TrimSpace(category.Name), strings.TrimSpace(name)) {
			return category.Id, nil
		}
	}

	id, _ := ksuid.NewRandom()
	newCategory := categoryDomain.NewCategory(id.String(), name, icon, color)
	newCategory.UserId = userId

	if err := s.categoryRepository.Save(ctx, newCategory); err != nil {
		return "", err
	}

	return newCategory.Id, nil
}
