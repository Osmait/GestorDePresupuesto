package transaction

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
	"github.com/osmait/gestorDePresupuesto/internal/domain/transaction"
	"github.com/osmait/gestorDePresupuesto/internal/platform/apptime"
	dto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/transaction"
	transactionRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/transaction"
	"github.com/osmait/gestorDePresupuesto/internal/services/errorhttp"
	"github.com/osmait/gestorDePresupuesto/internal/services/notification"
	"github.com/rs/zerolog/log"
	"github.com/segmentio/ksuid"

	"github.com/osmait/gestorDePresupuesto/internal/platform/cache"
	budgetRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/budget"
	"github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/txhelper"
)

const (
	BILL                     = "bill"
	CARD_PAYMENT             = "card_payment"
	LOAN_DISBURSEMENT        = "loan_disbursement"
	LOAN_COLLECTION          = "loan_collection"
	INVESTMENT_PURCHASE      = "investment_purchase"
	INVESTMENT_FUNDING       = "investment_funding"
	LOAN_CANCELLATION_REFUND = "loan_cancellation_refund"
)

// ErrManagedTransaction rejects editing or deleting a transaction the app
// manages itself (see transaction.IsEditable / IsDeletable).
var ErrManagedTransaction = fmt.Errorf("%w: this transaction is managed by the app (card payment, loan, broker funding or balance adjustment); use its own screen, reconcile the account or delete the adjustment instead", errorhttp.ErrBadRequest)

// The method parameters named `transaction` shadow the domain package.
func isEditable(t string) bool  { return transaction.IsEditable(t) }
func isDeletable(t string) bool { return transaction.IsDeletable(t) }

type AICacheInvalidator interface {
	InvalidateUserAnalysis(userID string)
	InvalidateUserExtractions(userID string)
}

type TransactionService struct {
	transactionRepository transactionRepo.TransactionRepositoryInterface
	budgetRepository      budgetRepo.BudgetRepoInterface
	notificationService   *notification.NotificationService
	cache                 cache.CacheRepository
	aiCache               AICacheInvalidator
	usdToDopRateFn        func(context.Context) (money.Amount, error)
	loc                   *time.Location
}

// Option configures a TransactionService.
type Option func(*TransactionService)

// WithLocation sets the app time zone that calendar days and months of
// transaction filters are cut in (default apptime.Default()).
func WithLocation(loc *time.Location) Option {
	return func(s *TransactionService) {
		if loc != nil {
			s.loc = loc
		}
	}
}

func NewTransactionService(transactionRepository transactionRepo.TransactionRepositoryInterface, budgetReposiotry budgetRepo.BudgetRepoInterface, notificationService *notification.NotificationService, cache cache.CacheRepository, aiCache AICacheInvalidator, usdToDopRateFn func(context.Context) (money.Amount, error), opts ...Option) *TransactionService {
	s := &TransactionService{
		transactionRepository: transactionRepository,
		budgetRepository:      budgetReposiotry,
		notificationService:   notificationService,
		cache:                 cache,
		aiCache:               aiCache,
		usdToDopRateFn:        usdToDopRateFn,
	}
	for _, opt := range opts {
		opt(s)
	}
	return s
}

// Location returns the app time zone (apptime.Default() when none was
// configured, or on a nil service).
func (s *TransactionService) Location() *time.Location {
	if s == nil {
		return apptime.Default()
	}
	return apptime.OrDefault(s.loc)
}

// listCachePrefix is the cache invalidation group of userId's transaction
// lists (see cache.InMemoryCache: invalidating it is O(1)).
func listCachePrefix(userId string) string {
	return "transactions:user:" + userId + ":"
}

// invalidateLists drops userId's cached transaction lists now and once more
// after the request transaction ends: a list read concurrently, before this
// write commits, could otherwise put pre-write data back for the whole TTL.
func (s TransactionService) invalidateLists(ctx context.Context, userId string) {
	prefix := listCachePrefix(userId)
	s.cache.DeleteByPrefix(prefix)
	txhelper.AfterTx(ctx, func() { s.cache.DeleteByPrefix(prefix) })
}

// CreateTransaction records a new transaction, checks for budget thresholds, and triggers alerts if necessary.
func (s TransactionService) CreateTransaction(ctx context.Context, name, description string, amount money.Amount, typeTransaction string, accountId string, userId string, categoryId string, budgetId string, currency string, createdAt time.Time) error {
	_, err := s.CreateTransactionWithID(ctx, name, description, amount, typeTransaction, accountId, userId, categoryId, budgetId, currency, createdAt)
	return err
}

// ErrNotUserType rejects creating, through a user-facing entry point (REST,
// MCP, AI import), a type the app writes itself as part of a larger operation.
var ErrNotUserType = fmt.Errorf("%w: only income and bill transactions can be created directly; use the card payment, loan, investment or reconcile flows for the others", errorhttp.ErrBadRequest)

// CreateUserTransaction creates a transaction on behalf of the user. Unlike
// CreateTransactionWithID, which services also use to write their managed
// rows, it only accepts the user's own types (see transaction.IsUserType).
func (s TransactionService) CreateUserTransaction(ctx context.Context, name, description string, amount money.Amount, typeTransaction string, accountId string, userId string, categoryId string, budgetId string, currency string, createdAt time.Time) (string, error) {
	if !transaction.IsUserType(typeTransaction) {
		return "", ErrNotUserType
	}
	return s.CreateTransactionWithID(ctx, name, description, amount, typeTransaction, accountId, userId, categoryId, budgetId, currency, createdAt)
}

func (s TransactionService) CreateTransactionWithID(ctx context.Context, name, description string, amount money.Amount, typeTransaction string, accountId string, userId string, categoryId string, budgetId string, currency string, createdAt time.Time) (string, error) {
	uuid, err := ksuid.NewRandom()
	if err != nil {
		return "", err
	}
	id := uuid.String()
	// Amounts are always stored as positive; type_transation determines direction.
	amount = amount.Abs()

	resolvedCurrency, err := s.transactionRepository.ResolveAndValidateCurrencyForAccount(ctx, userId, accountId, currency)
	if err != nil {
		return "", err
	}

	transaction := transaction.NewTransaction(id, name, description, typeTransaction, accountId, categoryId, amount)
	transaction.UserId = userId
	transaction.Currency = resolvedCurrency
	if !createdAt.IsZero() {
		transaction.CreatedAt = createdAt
	} else {
		transaction.CreatedAt = time.Now()
	}

	budget, _ := s.budgetRepository.FindByCategory(ctx, categoryId, userId)
	if budget != nil {
		transaction.BudgetId = budget.Id
	}

	log.Debug().Str("category_id", transaction.CategoryId).Msg("creating transaction")

	err = s.transactionRepository.Save(ctx, transaction)
	if err != nil {
		return "", err
	}
	s.invalidateLists(ctx, userId)

	if s.aiCache != nil {
		s.aiCache.InvalidateUserAnalysis(userId)
		s.aiCache.InvalidateUserExtractions(userId)
	}

	// Check Budget Thresholds
	log.Debug().Msgf("Checking Alert Conditions: BudgetFound=(%v), Type=(%s), BillConst=(%s)", budget != nil, typeTransaction, BILL)
	if budget != nil {
		log.Debug().Msgf("Budget Details: ID=%s, Amount=%s", budget.Id, budget.Amount)
	}

	if budget != nil && typeTransaction == BILL {
		log.Debug().Str("budget_id", budget.Id).Msg("checking budget thresholds for transaction")
		// The spent amount is read synchronously on the caller's context: inside
		// a request that is the RLS transaction, which already contains the new
		// transaction. Reading it from a goroutine with a detached context used
		// a second pooled connection while the request held one (pool deadlock
		// pressure) and raced the commit (the new bill could be missing).
		// Only the notification (DB insert + SSE push) is sent asynchronously,
		// after the commit.
		s.checkBudgetThreshold(ctx, budget.CategoryId, budget.Amount, userId, amount, resolvedCurrency, transaction.CreatedAt)
	}

	return id, nil
}

// checkBudgetThreshold alerts when the new bill makes the category's
// spending this month (the budget's spending, see FindCurrentCategorySpent)
// cross 70% or 100% of the budget. A bill dated outside the current local
// month does not change this month's spending and is not checked.
func (s TransactionService) checkBudgetThreshold(ctx context.Context, categoryID string, budgetAmount money.Amount, userId string, amount money.Amount, resolvedCurrency string, createdAt time.Time) {
	if loc := s.Location(); !apptime.StartOfMonth(createdAt, loc).Equal(apptime.StartOfMonth(time.Now(), loc)) {
		return
	}
	usdToDop := money.FromInt(60)
	if s.usdToDopRateFn != nil {
		if rate, rateErr := s.usdToDopRateFn(ctx); rateErr == nil && rate.IsPositive() {
			usdToDop = rate
		}
	}

	currentSpent, err := s.transactionRepository.FindCurrentCategorySpent(ctx, categoryID, userId, usdToDop)
	if err != nil {
		log.Error().Err(err).Msg("failed to get current budget details for alert")
		return
	}

	// budget.Amount is positive, currentSpent is positive (bills stored as positive).
	spentPositive := currentSpent
	limit := budgetAmount
	currentTransactionImpact := amount
	if resolvedCurrency == "USD" {
		currentTransactionImpact = currentTransactionImpact.Mul(usdToDop)
	}

	log.Debug().Stringer("current_spent", spentPositive).Stringer("limit", limit).Msg("budget status")

	if limit.IsPositive() {
		// Thresholds are compared exactly in decimal; the percentage is
		// only converted for the human-readable message.
		previousSpent := spentPositive.Sub(currentTransactionImpact) // remove current transaction with conversion if needed
		ratio := spentPositive.Div(limit)
		previousRatio := previousSpent.Div(limit)
		one := money.FromInt(1)
		warning := money.New(7, -1)
		usedPercent := ratio.MulInt(100).StringFixed(0)

		log.Debug().Stringer("ratio", ratio).Stringer("previous_ratio", previousRatio).Msg("budget percentages")

		var alertType string
		var alertMessage string

		if ratio.GreaterThanOrEqual(one) && previousRatio.LessThan(one) {
			alertType = "budget_critical"
			alertMessage = fmt.Sprintf("🚨 Critical: You have exceeded your budget for this category! (%s%% used)", usedPercent)
		} else if ratio.GreaterThanOrEqual(warning) && ratio.LessThan(one) && previousRatio.LessThan(warning) {
			alertType = "budget_warning"
			alertMessage = fmt.Sprintf("⚠️ Warning: You have used %s%% of your budget for this category.", usedPercent)
		}

		if alertType != "" {
			log.Info().Str("alert_type", alertType).Msg("triggering budget alert")
			notificationPayload := map[string]interface{}{
				"type":    alertType,
				"message": alertMessage,
				"amount":  spentPositive.RoundCents(),
			}
			payloadBytes, _ := json.Marshal(notificationPayload)
			// Sent asynchronously once the request transaction commits, on a
			// detached context (never the request/gin context, never the
			// request transaction); see NotificationService.SendToUserAsync.
			s.notificationService.SendToUserAsync(ctx, userId, string(payloadBytes))
		} else {
			log.Debug().Msg("no alert threshold crossed")
		}
	}
}

// FindAll retrieves the transactions of userId for an account within a date range.
func (s TransactionService) FindAll(ctx context.Context, date string, date2 string, id string, userId string) ([]*dto.TransactionResponse, error) {
	transactionList, err := s.transactionRepository.FindAll(ctx, date, date2, id, userId)
	if err != nil {
		return nil, err
	}

	var transactionResponseList []*dto.TransactionResponse
	for _, transaction := range transactionList {
		transactionResponse := dto.NewTransactionResponse(transaction.Id,
			transaction.Name,
			transaction.Description,
			transaction.TypeTransation,
			transaction.AccountId,
			transaction.CategoryId,
			transaction.Amount,
			transaction.Currency,
			transaction.CreatedAt)
		transactionResponse.BudgetId = transaction.BudgetId
		transactionResponseList = append(transactionResponseList, transactionResponse)

	}

	log.Debug().Int("count", len(transactionResponseList)).Msg("found transactions")
	return transactionResponseList, nil
}

// FindAllOfAllAccounts retrieves all transactions for a user across all accounts.
func (s TransactionService) FindAllOfAllAccounts(ctx context.Context, id string) ([]*dto.TransactionResponse, error) {
	transactionList, err := s.transactionRepository.FindAllOfAllAccounts(ctx, id)
	if err != nil {
		return nil, err
	}

	var transactionResponseList []*dto.TransactionResponse
	for _, transaction := range transactionList {
		transactionResponse := dto.NewTransactionResponse(transaction.Id,
			transaction.Name,
			transaction.Description,
			transaction.TypeTransation,
			transaction.AccountId,
			transaction.CategoryId,
			transaction.Amount,
			transaction.Currency,
			transaction.CreatedAt)
		transactionResponse.BudgetId = transaction.BudgetId
		transactionResponseList = append(transactionResponseList, transactionResponse)

	}

	return transactionResponseList, nil
}

// FindAllOfAllAccountsWithFilters retrieves all transactions across all user accounts with filtering and pagination
func (s TransactionService) FindAllOfAllAccountsWithFilters(
	ctx context.Context,
	userId string,
	filter *dto.TransactionFilter,
	includeSummary bool,
) (interface{}, error) {
	// Cache first: a cached response already carries its total count.
	filterBytes, _ := json.Marshal(filter)
	cacheKey := fmt.Sprintf("%sfilter:%s:summary:%v", listCachePrefix(userId), string(filterBytes), includeSummary)

	if cachedResponse, found := s.cache.Get(cacheKey); found {
		log.Debug().Msg("Serving transactions from cache")
		return cachedResponse, nil
	}

	totalCount, err := s.transactionRepository.CountWithFilters(ctx, userId, filter)
	if err != nil {
		return nil, err
	}

	// Get filtered and paginated transactions
	transactionList, err := s.transactionRepository.FindAllOfAllAccountsWithFilters(ctx, userId, filter)
	if err != nil {
		return nil, err
	}

	// Convert to response DTOs
	transactionResponseList := s.convertToResponseList(transactionList)

	// Create paginated response
	if includeSummary {
		usdToDop := money.FromInt(60)
		if s.usdToDopRateFn != nil {
			if rate, rateErr := s.usdToDopRateFn(ctx); rateErr == nil && rate.IsPositive() {
				usdToDop = rate
			}
		}

		// Aggregated in SQL over every matching row (pagination ignored)
		// instead of loading them all.
		groups, err := s.transactionRepository.SummarizeWithFilters(ctx, userId, filter)
		if err != nil {
			return nil, err
		}
		summary := dto.CalculateSummaryFromGroups(groups, totalCount, usdToDop)

		response := dto.NewPaginatedTransactionResponseWithSummary(
			transactionResponseList,
			filter,
			totalCount,
			summary,
		)
		s.cache.Set(cacheKey, response, 5*time.Minute)
		return response, nil
	}

	response := dto.NewPaginatedTransactionResponse(
		transactionResponseList,
		filter,
		totalCount,
	)
	s.cache.Set(cacheKey, response, 5*time.Minute)
	return response, nil
}

// FindAllWithFilters retrieves the transactions of userId for a specific account
// (filter.AccountId) with filtering and pagination. Accounts of other users
// simply yield no rows.
func (s TransactionService) FindAllWithFilters(
	ctx context.Context,
	userId string,
	filter *dto.TransactionFilter,
	includeSummary bool,
) (interface{}, error) {
	// Get total count first
	totalCount, err := s.transactionRepository.CountWithFilters(ctx, userId, filter)
	if err != nil {
		return nil, err
	}

	// Get filtered and paginated transactions
	transactionList, err := s.transactionRepository.FindAllWithFilters(ctx, userId, filter)
	if err != nil {
		return nil, err
	}

	// Convert to response DTOs
	transactionResponseList := s.convertToResponseList(transactionList)

	// Create paginated response
	if includeSummary {
		usdToDop := money.FromInt(60)
		if s.usdToDopRateFn != nil {
			if rate, rateErr := s.usdToDopRateFn(ctx); rateErr == nil && rate.IsPositive() {
				usdToDop = rate
			}
		}

		// Aggregated in SQL (filter.AccountId scopes it to the account).
		groups, err := s.transactionRepository.SummarizeWithFilters(ctx, userId, filter)
		if err != nil {
			return nil, err
		}
		summary := dto.CalculateSummaryFromGroups(groups, totalCount, usdToDop)

		return dto.NewPaginatedTransactionResponseWithSummary(
			transactionResponseList,
			filter,
			totalCount,
			summary,
		), nil
	}

	return dto.NewPaginatedTransactionResponse(
		transactionResponseList,
		filter,
		totalCount,
	), nil
}

// convertToResponseList converts domain transactions to response DTOs
func (s TransactionService) convertToResponseList(transactions []*transaction.Transaction) []*dto.TransactionResponse {
	var transactionResponseList []*dto.TransactionResponse
	for _, transaction := range transactions {
		transactionResponse := dto.NewTransactionResponse(
			transaction.Id,
			transaction.Name,
			transaction.Description,
			transaction.TypeTransation,
			transaction.AccountId,
			transaction.CategoryId,
			transaction.Amount,
			transaction.Currency,
			transaction.CreatedAt,
		)
		transactionResponse.BudgetId = transaction.BudgetId
		transactionResponseList = append(transactionResponseList, transactionResponse)
	}
	return transactionResponseList
}

// UpdateTransaction modifies an existing transaction. Transactions the app
// manages (balance adjustments, card payments received) cannot be edited, nor
// can a transaction be turned into one.
func (s *TransactionService) UpdateTransaction(ctx context.Context, id string, transaction *transaction.Transaction) error {
	current, err := s.transactionRepository.TypeOf(ctx, id, transaction.UserId)
	if err != nil {
		return err
	}
	if !isEditable(current) || !isEditable(transaction.TypeTransation) {
		return ErrManagedTransaction
	}
	transaction.Amount = transaction.Amount.Abs()

	resolvedCurrency, err := s.transactionRepository.ResolveAndValidateCurrencyForAccount(ctx, transaction.UserId, transaction.AccountId, transaction.Currency)
	if err != nil {
		return err
	}
	transaction.Currency = resolvedCurrency

	budget, _ := s.budgetRepository.FindByCategory(ctx, transaction.CategoryId, transaction.UserId)
	if budget != nil {
		transaction.BudgetId = budget.Id
	} else {
		transaction.BudgetId = ""
	}
	if err := s.transactionRepository.Update(ctx, id, transaction); err != nil {
		return err
	}
	s.invalidateLists(ctx, transaction.UserId)

	if s.aiCache != nil {
		s.aiCache.InvalidateUserAnalysis(transaction.UserId)
		s.aiCache.InvalidateUserExtractions(transaction.UserId)
	}
	return nil
}

// DeleteTransaction removes a transaction by its ID and User ID. A card
// payment received cannot be deleted on its own (see transaction.IsDeletable).
func (s TransactionService) DeleteTransaction(ctx context.Context, id string, userId string) error {
	current, err := s.transactionRepository.TypeOf(ctx, id, userId)
	if err != nil {
		return err
	}
	if !isDeletable(current) {
		return ErrManagedTransaction
	}
	err = s.transactionRepository.Delete(ctx, id, userId)
	if err == nil {
		s.invalidateLists(ctx, userId)

		if s.aiCache != nil {
			s.aiCache.InvalidateUserAnalysis(userId)
			s.aiCache.InvalidateUserExtractions(userId)
		}
	}
	return err
}
