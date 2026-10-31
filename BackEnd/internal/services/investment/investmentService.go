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

// Create records a purchase for a user: quantity units at purchasePrice, both
// strictly positive, priced in settlementCurrency (DOP or USD; USD when
// empty). Its cost, quantity * price rounded to cents, is debited from the
// broker wallet in that currency (merged into an existing position of the
// same symbol, type and currency). Selling is not supported: a negative
// quantity is rejected instead of being turned into a purchase.
func (s *InvestmentService) Create(ctx context.Context, id, userId string, investmentType investment.InvestmentType, name, symbol string, quantity, purchasePrice, currentPrice money.Amount, settlementCurrency string) error {
	if id == "" {
		id = ksuid.New().String()
	}

	if err := validateQuantityAndPrice(quantity, purchasePrice); err != nil {
		return err
	}
	if currentPrice.IsNegative() {
		return fmt.Errorf("%w: current_price cannot be negative", errorhttp.ErrBadRequest)
	}
	settlementCurrency, err := resolveSettlementCurrency(settlementCurrency)
	if err != nil {
		return err
	}

	inv := investment.NewInvestment(id, userId, investmentType, name, symbol, quantity, purchasePrice, currentPrice)
	inv.SettlementCurrency = settlementCurrency
	// Cost of the purchase: quantity * unit price computed exactly, rounded
	// half-even to cents (it is debited from the funding wallet).
	requiredAmount := inv.Cost()
	if !requiredAmount.IsPositive() {
		return fmt.Errorf("%w: investment amount must be greater than 0", errorhttp.ErrBadRequest)
	}
	inv.SourceAmount = requiredAmount

	err = s.repo.ConsumeFundingForInvestment(ctx, inv, settlementCurrency, requiredAmount)
	if err != nil {
		if errors.Is(err, investmentRepo.ErrInsufficientFunding) {
			return fmt.Errorf("%w: insufficient broker funding in %s", errorhttp.ErrBadRequest, settlementCurrency)
		}
		return err
	}

	return nil
}

// validateQuantityAndPrice rejects a purchase whose quantity or unit price is
// not strictly positive.
func validateQuantityAndPrice(quantity, purchasePrice money.Amount) error {
	if !quantity.IsPositive() {
		return fmt.Errorf("%w: quantity must be greater than 0", errorhttp.ErrBadRequest)
	}
	if !purchasePrice.IsPositive() {
		return fmt.Errorf("%w: purchase_price must be greater than 0", errorhttp.ErrBadRequest)
	}
	return nil
}

// resolveSettlementCurrency normalizes a settlement currency (USD when empty)
// and rejects anything but DOP and USD: positions are valued in their own
// currency and converted to DOP only from USD.
func resolveSettlementCurrency(currency string) (string, error) {
	resolved := investment.NormalizeSettlementCurrency(currency)
	if !money.IsSupportedCurrency(resolved) {
		return "", fmt.Errorf("%w: settlement_currency must be DOP or USD", errorhttp.ErrBadRequest)
	}
	return resolved, nil
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

	targetCurrency := money.NormalizeCurrency(req.TargetCurrency, sourceCurrency)
	if !money.IsSupportedCurrency(targetCurrency) {
		return fmt.Errorf("%w: target_currency must be DOP or USD", errorhttp.ErrBadRequest)
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

// quoteMaxAge is how long a refreshed quote is kept before fetching it again.
const quoteMaxAge = 5 * time.Minute

// quoteWait bounds how long loading the investments waits for quotes.
const quoteWait = 2 * time.Second

// positionsToRefresh returns the positions whose current price is refreshed
// from a market quote: USD positions whose price is unset or older than
// quoteMaxAge. Quotes are USD prices, so a DOP position is never refreshed:
// it keeps the price the user entered (a USD quote written into it would be
// read as DOP, and its value and P&L would be nonsense).
func positionsToRefresh(investments []*investment.Investment, now time.Time) []*investment.Investment {
	var stale []*investment.Investment
	for _, inv := range investments {
		if !inv.QuotedInUSD() {
			continue
		}
		if now.Sub(inv.UpdatedAt) > quoteMaxAge || inv.CurrentPrice.IsZero() {
			stale = append(stale, inv)
		}
	}
	return stale
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
	stale := positionsToRefresh(investments, time.Now())
	if len(stale) == 0 || s.quoteService == nil {
		return investments, nil
	}

	// Wait at most quoteWait for the quotes. Cached quotes (and cached
	// failures) answer at once; a lookup still in flight when the wait ends
	// keeps running in the quote service (bounded, deduplicated per symbol)
	// and fills its cache, so the next load gets it. Every goroutine here
	// returns by the deadline.
	waitCtx, cancel := context.WithTimeout(ctx, quoteWait)
	defer cancel()
	results := make(chan quoteUpdate, len(stale))
	for _, inv := range stale {
		go func(i *investment.Investment) {
			price, _, _, err := s.quoteService.GetQuoteContext(waitCtx, i.Symbol)
			if err != nil || !price.IsPositive() {
				price = money.Zero
			}
			results <- quoteUpdate{inv: i, price: price}
		}(inv)
	}

	var updates []quoteUpdate
	for range stale {
		if u := <-results; u.price.IsPositive() {
			updates = append(updates, u)
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
//
// Quantity and purchase price can be edited (the form edits them to fix a
// typo) and must stay strictly positive; the broker wallet follows the cost
// (quantity * purchase price, in cents): a higher cost is debited from the
// wallet in the position's currency, with the funds check of a purchase, and a
// lower one is credited back, never more than the position took from it
// (source_amount; legacy positions that were never funded refund nothing).
// The settlement currency cannot be changed: the cost sits in that wallet.
func (s *InvestmentService) Update(ctx context.Context, id string, userId string, input UpdateInput) (*investment.Investment, error) {
	if strings.TrimSpace(id) == "" || userId == "" {
		return nil, errorhttp.ErrNotFound
	}
	if input.Quantity != nil && !input.Quantity.IsPositive() {
		return nil, fmt.Errorf("%w: quantity must be greater than 0", errorhttp.ErrBadRequest)
	}
	if input.PurchasePrice != nil && !input.PurchasePrice.IsPositive() {
		return nil, fmt.Errorf("%w: purchase_price must be greater than 0", errorhttp.ErrBadRequest)
	}
	if input.CurrentPrice != nil && input.CurrentPrice.IsNegative() {
		return nil, fmt.Errorf("%w: current_price cannot be negative", errorhttp.ErrBadRequest)
	}

	// Locked until the request transaction ends: the full row is written back
	// below, so a concurrent purchase must not change it in between.
	inv, err := s.repo.FindByIDForUpdate(ctx, id, userId)
	if err != nil {
		return nil, err
	}

	if input.SettlementCurrency != nil {
		currency, err := resolveSettlementCurrency(*input.SettlementCurrency)
		if err != nil {
			return nil, err
		}
		if currency != inv.Currency() {
			return nil, fmt.Errorf("%w: settlement_currency cannot be changed (the position was paid from the %s wallet)", errorhttp.ErrBadRequest, inv.Currency())
		}
		inv.SettlementCurrency = currency
	}

	oldCost := inv.Cost()

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

	// Ownership is fixed by the lookup above, never by the caller.
	inv.ID = id
	inv.UserID = userId
	inv.UpdatedAt = time.Now()

	if err := s.adjustWalletForCost(ctx, inv, inv.Cost().Sub(oldCost)); err != nil {
		return nil, err
	}

	if err := s.repo.Update(ctx, inv); err != nil {
		return nil, err
	}
	return inv, nil
}

// walletDelta is what an edit that changes a position's cost by costDelta
// moves out of the wallet (positive: debit, negative: credit). A credit is
// capped at sourceAmount, what the position took from the wallet.
func walletDelta(costDelta, sourceAmount money.Amount) money.Amount {
	if costDelta.IsNegative() {
		return money.Max(costDelta, money.Max(sourceAmount, money.Zero).Neg())
	}
	return costDelta
}

// adjustWalletForCost moves the wallet by walletDelta(costDelta) and keeps
// the position's source_amount (what it took from the wallet) in step.
func (s *InvestmentService) adjustWalletForCost(ctx context.Context, inv *investment.Investment, costDelta money.Amount) error {
	delta := walletDelta(costDelta, inv.SourceAmount)
	if delta.IsZero() {
		return nil
	}
	description := "Investment edit - " + strings.ToUpper(strings.TrimSpace(inv.Symbol))
	if err := s.repo.AdjustFundingForInvestment(ctx, inv.UserID, inv.ID, inv.Currency(), delta, description); err != nil {
		if errors.Is(err, investmentRepo.ErrInsufficientFunding) {
			return fmt.Errorf("%w: insufficient broker funding in %s for the higher cost", errorhttp.ErrBadRequest, inv.Currency())
		}
		return err
	}
	inv.SourceAmount = inv.SourceAmount.Add(delta)
	return nil
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
