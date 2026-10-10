package investment

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	accountDomain "github.com/osmait/gestorDePresupuesto/internal/domain/account"
	categoryDomain "github.com/osmait/gestorDePresupuesto/internal/domain/category"
	"github.com/osmait/gestorDePresupuesto/internal/domain/investment"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
	"github.com/osmait/gestorDePresupuesto/internal/platform/i18n"
	accountRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/account"
	categoryRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/category"
	investmentRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/investment"
	"github.com/osmait/gestorDePresupuesto/internal/services/errorhttp"
	"github.com/osmait/gestorDePresupuesto/internal/services/funds"
	"github.com/osmait/gestorDePresupuesto/internal/services/quote"
	"github.com/osmait/gestorDePresupuesto/internal/services/systemcategory"
	"github.com/osmait/gestorDePresupuesto/internal/services/transaction"
	"github.com/segmentio/ksuid"
)

// ErrCreditCardFundingSource is returned when a credit card account is used to
// fund the broker wallet: only bank/cash accounts can be a funding source.
var ErrCreditCardFundingSource = fmt.Errorf("%w: a credit card account cannot be used as the source account for broker funding", errorhttp.ErrBadRequest)

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
	Amount     money.Amount
	CategoryID string
}

// UpdateInput holds the user-editable fields of an investment. Nil fields are
// left unchanged. Ownership fields (id, user_id) and funding-derived fields
// (source account/amount, exchange rate) are deliberately not editable.
type UpdateInput struct {
	Type               *investment.InvestmentType
	Name               *string
	Symbol             *string
	Quantity           *money.Amount
	PurchasePrice      *money.Amount
	CurrentPrice       *money.Amount
	SettlementCurrency *string
}

type FundingRequest struct {
	SourceAccountID string
	SourceAmount    money.Amount
	SourceCurrency  string
	TargetCurrency  string
	ExchangeRate    money.Amount
	FeeAmount       money.Amount
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
func (s *InvestmentService) Create(ctx context.Context, id, userId string, investmentType investment.InvestmentType, name, symbol string, quantity, purchasePrice, currentPrice money.Amount, settlementCurrency string) error {
	if id == "" {
		id = ksuid.New().String()
	}

	settlementCurrency = strings.ToUpper(strings.TrimSpace(settlementCurrency))
	if settlementCurrency == "" {
		settlementCurrency = "USD"
	}

	// Cost of the purchase: quantity * unit price computed exactly, rounded
	// half-even to cents (it is debited from the funding wallet).
	requiredAmount := quantity.Mul(purchasePrice).Abs().RoundCents()
	if !requiredAmount.IsPositive() {
		return fmt.Errorf("%w: investment amount must be greater than 0", errorhttp.ErrBadRequest)
	}

	inv := investment.NewInvestment(id, userId, investmentType, name, symbol, quantity, purchasePrice, currentPrice)
	inv.SettlementCurrency = settlementCurrency
	inv.SourceAmount = requiredAmount

	err := s.repo.ConsumeFundingForInvestment(ctx, inv, settlementCurrency, requiredAmount)
	if err != nil {
		if errors.Is(err, investmentRepo.ErrInsufficientFunding) {
			return fmt.Errorf("%w: insufficient broker funding in %s", errorhttp.ErrBadRequest, settlementCurrency)
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
		return fmt.Errorf("%w: source_account_id is required", errorhttp.ErrBadRequest)
	}
	sourceAmount := req.SourceAmount.Abs()
	if !sourceAmount.IsPositive() {
		return fmt.Errorf("%w: source_amount must be greater than 0", errorhttp.ErrBadRequest)
	}

	// Lock the source account until the request transaction ends so the funds
	// check below cannot interleave with another debit of the same account.
	account, err := s.accountRepository.FindByIdAndUserIdForUpdate(ctx, sourceAccountID, userID)
	if err != nil {
		if errors.Is(err, errorhttp.ErrNotFound) || errors.Is(err, sql.ErrNoRows) {
			return fmt.Errorf("%w: source account not found", errorhttp.ErrBadRequest)
		}
		return err
	}
	if account.Type == accountDomain.AccountTypeCreditCard {
		return ErrCreditCardFundingSource
	}

	sourceCurrency := strings.ToUpper(strings.TrimSpace(account.Currency))
	if sourceCurrency == "" {
		sourceCurrency = "DOP"
	}

	targetCurrency := strings.ToUpper(strings.TrimSpace(req.TargetCurrency))
	if targetCurrency == "" {
		targetCurrency = sourceCurrency
	}

	feeAmount := req.FeeAmount.Abs()
	// No overdrafts: the source account must cover the transfer plus the fee
	// debited from it.
	if err := funds.Require(ctx, s.accountRepository, account, userID, sourceAmount.Add(feeAmount)); err != nil {
		return err
	}
	creditedTargetAmount := sourceAmount
	if sourceCurrency != targetCurrency {
		if !req.ExchangeRate.IsPositive() {
			return fmt.Errorf("%w: exchange_rate is required when converting %s to %s", errorhttp.ErrBadRequest, sourceCurrency, targetCurrency)
		}
		// Converted amount: divided exactly, rounded half-even to cents.
		creditedTargetAmount = sourceAmount.Div(req.ExchangeRate).RoundCents()
	}

	fundingCategoryID, err := s.ensureSystemCategory(ctx, userID, categoryDomain.SystemBrokerFunding)
	if err != nil {
		return err
	}

	txName := i18n.T(ctx, i18n.BrokerFundingName)
	txDescription := i18n.T(ctx, i18n.BrokerFundingDescription)
	if sourceCurrency != targetCurrency {
		txDescription = i18n.T(ctx, i18n.BrokerFundingFXDesc, sourceCurrency, targetCurrency, req.ExchangeRate.StringFixed(6))
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

	if !feeAmount.IsPositive() {
		return nil
	}

	feeCategoryID, err := s.ensureSystemCategory(ctx, userID, categoryDomain.SystemInvestmentFees)
	if err != nil {
		return err
	}

	return s.transactionService.CreateTransaction(
		ctx,
		i18n.T(ctx, i18n.BrokerFeeName),
		i18n.T(ctx, i18n.BrokerFeeDescription),
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

	// Refresh stale quotes. Only the HTTP quote lookups run concurrently; the
	// prices are persisted afterwards on the caller's context (the request's
	// RLS transaction), one by one. Writing from the lookup goroutines with a
	// detached context used to need extra pooled connections while this
	// request already held one (pool deadlock under load), and a *sql.Tx must
	// not be shared between goroutines.
	type quoteUpdate struct {
		inv   *investment.Investment
		price money.Amount
	}
	var stale []*investment.Investment
	for _, inv := range investments {
		// Update if older than 5 minutes or price is 0 (initial)
		if time.Since(inv.UpdatedAt) > 5*time.Minute || inv.CurrentPrice.IsZero() {
			stale = append(stale, inv)
		}
	}
	if len(stale) == 0 || s.quoteService == nil {
		return investments, nil
	}

	results := make(chan quoteUpdate, len(stale))
	for _, inv := range stale {
		go func(i *investment.Investment) {
			// WithoutCancel: a quote may outlive the 2s wait below, but its client
			// span stays in the request trace.
			price, _, _, err := s.quoteService.GetQuoteContext(context.WithoutCancel(ctx), i.Symbol)
			if err != nil || !price.IsPositive() {
				price = money.Zero
			}
			results <- quoteUpdate{inv: i, price: price}
		}(inv)
	}

	// Wait at most 2 seconds for the quotes; slower ones are skipped (the
	// buffered channel lets their goroutines finish without blocking).
	timeout := time.NewTimer(2 * time.Second)
	defer timeout.Stop()
	var updates []quoteUpdate
collect:
	for range stale {
		select {
		case u := <-results:
			if u.price.IsPositive() {
				updates = append(updates, u)
			}
		case <-timeout.C:
			break collect
		}
	}

	for _, u := range updates {
		// Persist only the quote. Writing the whole row here would overwrite
		// a quantity/cost changed concurrently by a purchase (lost update).
		// Errors are ignored so a failed refresh never blocks the read.
		if err := s.repo.UpdateCurrentPrice(ctx, u.inv.ID, u.inv.UserID, u.price); err != nil {
			continue
		}
		u.inv.CurrentPrice = u.price
		u.inv.UpdatedAt = time.Now()
	}

	return investments, nil
}

// Update applies the editable fields in `input` to the investment `id` owned by
// userId. An investment that does not exist or belongs to another user yields
// errorhttp.ErrNotFound.
func (s *InvestmentService) Update(ctx context.Context, id string, userId string, input UpdateInput) (*investment.Investment, error) {
	if strings.TrimSpace(id) == "" || userId == "" {
		return nil, errorhttp.ErrNotFound
	}

	// Locked until the request transaction ends: the full row is written back
	// below, so a concurrent purchase must not change it in between.
	inv, err := s.repo.FindByIDForUpdate(ctx, id, userId)
	if err != nil {
		return nil, err
	}

	if input.Type != nil {
		inv.Type = *input.Type
	}
	if input.Name != nil {
		inv.Name = *input.Name
	}
	if input.Symbol != nil {
		inv.Symbol = *input.Symbol
	}
	if input.Quantity != nil {
		inv.Quantity = *input.Quantity
	}
	if input.PurchasePrice != nil {
		inv.PurchasePrice = *input.PurchasePrice
	}
	if input.CurrentPrice != nil {
		inv.CurrentPrice = *input.CurrentPrice
	}
	if input.SettlementCurrency != nil {
		inv.SettlementCurrency = strings.ToUpper(strings.TrimSpace(*input.SettlementCurrency))
	}

	// Ownership is fixed by the lookup above, never by the caller.
	inv.ID = id
	inv.UserID = userId
	inv.UpdatedAt = time.Now()

	if err := s.repo.Update(ctx, inv); err != nil {
		return nil, err
	}
	return inv, nil
}

// Delete removes the investment `id` owned by userId.
func (s *InvestmentService) Delete(ctx context.Context, id string, userId string) error {
	return s.repo.Delete(ctx, id, userId)
}

// ensureSystemCategory returns the id of the user's system category sys,
// found by its stable identity (never by the localized name).
func (s *InvestmentService) ensureSystemCategory(ctx context.Context, userId string, sys categoryDomain.System) (string, error) {
	return systemcategory.Ensure(ctx, s.categoryRepository, userId, sys)
}
