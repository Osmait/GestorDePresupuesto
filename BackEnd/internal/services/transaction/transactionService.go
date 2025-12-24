package transaction

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/osmait/gestorDePresupuesto/internal/domain/transaction"
	dto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/transaction"
	transactionRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/transaction"
	"github.com/osmait/gestorDePresupuesto/internal/services/notification"
	"github.com/rs/zerolog/log"
	"github.com/segmentio/ksuid"

	"github.com/osmait/gestorDePresupuesto/internal/platform/cache"
	budgetRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/budget"
)

const (
	BILL = "bill"
)

type TransactionService struct {
	transactionRepository transactionRepo.TransactionRepositoryInterface
	budgetRepository      budgetRepo.BudgetRepoInterface
	notificationService   *notification.NotificationService
	cache                 cache.CacheRepository
}

func NewTransactionService(transactionRepository transactionRepo.TransactionRepositoryInterface, budgetReposiotry budgetRepo.BudgetRepoInterface, notificationService *notification.NotificationService, cache cache.CacheRepository) *TransactionService {
	return &TransactionService{
		transactionRepository: transactionRepository,
		budgetRepository:      budgetReposiotry,
		notificationService:   notificationService,
		cache:                 cache,
	}
}

func (s TransactionService) CreateTransaction(ctx context.Context, name, description string, amount float64, typeTransaction string, accountId string, userId string, categoryId string, budgetId string) error {
	uuid, err := ksuid.NewRandom()
	if err != nil {
		return err
	}
	id := uuid.String()
	if typeTransaction == BILL {
		amount = amount * -1
	}

	transaction := transaction.NewTransaction(id, name, description, typeTransaction, accountId, categoryId, amount)
	transaction.UserId = userId

	budget, _ := s.budgetRepository.FindByCategory(ctx, categoryId)
	if budget != nil {
		transaction.BudgetId = budget.Id
	}

	log.Debug().Str("category_id", transaction.CategoryId).Msg("creating transaction")

	err = s.transactionRepository.Save(ctx, transaction)
	if err != nil {
		return err
	}
	s.cache.DeleteByPrefix(fmt.Sprintf("transactions:user:%s", userId))

	// Check Budget Thresholds
	log.Debug().Msgf("Checking Alert Conditions: BudgetFound=(%v), Type=(%s), BillConst=(%s)", budget != nil, typeTransaction, BILL)
	if budget != nil {
		log.Debug().Msgf("Budget Details: ID=%s, Amount=%f", budget.Id, budget.Amount)
	}

	if budget != nil && typeTransaction == BILL {
		log.Debug().Str("budget_id", budget.Id).Msg("checking budget thresholds for transaction")
		go func() {
			currentSpent, err := s.transactionRepository.FindCurrentBudget(context.Background(), budget.Id)
			if err != nil {
				log.Error().Err(err).Msg("failed to get current budget details for alert")
				return
			}

			// budget.Amount is positive, currentSpent is negative (bills). Make it positive for calculation.
			spentPositive := currentSpent * -1
			limit := budget.Amount

			log.Debug().Float64("current_spent", spentPositive).Float64("limit", limit).Msg("budget status")

			if limit > 0 {
				percentage := spentPositive / limit
				previousSpent := spentPositive - (amount * -1) // remove current transaction
				previousPercentage := previousSpent / limit

				log.Debug().Float64("percentage", percentage).Float64("previous_percentage", previousPercentage).Msg("budget percentages")

				var alertType string
				var alertMessage string

				if percentage >= 1.0 && previousPercentage < 1.0 {
					alertType = "budget_critical"
					alertMessage = fmt.Sprintf("🚨 Critical: You have exceeded your budget for this category! (%.0f%% used)", percentage*100)
				} else if percentage >= 0.7 && percentage < 1.0 && previousPercentage < 0.7 {
					alertType = "budget_warning"
					alertMessage = fmt.Sprintf("⚠️ Warning: You have used %.0f%% of your budget for this category.", percentage*100)
				}

				if alertType != "" {
					log.Info().Str("alert_type", alertType).Msg("triggering budget alert")
					notificationPayload := map[string]interface{}{
						"type":    alertType,
						"message": alertMessage,
						"amount":  spentPositive,
					}
					payloadBytes, _ := json.Marshal(notificationPayload)
					s.notificationService.SendToUser(userId, string(payloadBytes))
				} else {
					log.Debug().Msg("no alert threshold crossed")
				}
			}
		}()
	}

	return nil
}

func (s TransactionService) FindAll(ctx context.Context, date string, date2 string, id string) ([]*dto.TransactionResponse, error) {
	transactionList, err := s.transactionRepository.FindAll(ctx, date, date2, id)
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
			transaction.CreatedAt)
		transactionResponse.BudgetId = transaction.BudgetId
		transactionResponseList = append(transactionResponseList, transactionResponse)

	}

	log.Debug().Int("count", len(transactionResponseList)).Msg("found transactions")
	return transactionResponseList, nil
}

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
	// Get total count first
	totalCount, err := s.transactionRepository.CountWithFilters(ctx, userId, filter)
	if err != nil {
		return nil, err
	}

	// Cache Key Generation
	filterBytes, _ := json.Marshal(filter)
	cacheKey := fmt.Sprintf("transactions:user:%s:filter:%s:summary:%v", userId, string(filterBytes), includeSummary)

	if cachedResponse, found := s.cache.Get(cacheKey); found {
		log.Debug().Msg("Serving transactions from cache")
		return cachedResponse, nil
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
		// Get all transactions for summary calculation (without pagination)
		allTransactionsFilter := *filter
		allTransactionsFilter.Limit = 0 // Remove pagination for summary
		allTransactionsFilter.Offset = 0

		allTransactions, err := s.transactionRepository.FindAllOfAllAccountsWithFilters(ctx, userId, &allTransactionsFilter)
		if err != nil {
			return nil, err
		}

		allTransactionResponses := s.convertToResponseList(allTransactions)
		summary := dto.CalculateSummary(allTransactionResponses, totalCount)

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

// FindAllWithFilters retrieves transactions for a specific account with filtering and pagination
func (s TransactionService) FindAllWithFilters(
	ctx context.Context,
	filter *dto.TransactionFilter,
	includeSummary bool,
) (interface{}, error) {
	// Get total count first
	totalCount, err := s.transactionRepository.CountWithFilters(ctx, "", filter)
	if err != nil {
		return nil, err
	}

	// Get filtered and paginated transactions
	transactionList, err := s.transactionRepository.FindAllWithFilters(ctx, filter)
	if err != nil {
		return nil, err
	}

	// Convert to response DTOs
	transactionResponseList := s.convertToResponseList(transactionList)

	// Create paginated response
	if includeSummary {
		// Get all transactions for summary calculation (without pagination)
		allTransactionsFilter := *filter
		allTransactionsFilter.Limit = 0 // Remove pagination for summary
		allTransactionsFilter.Offset = 0

		allTransactions, err := s.transactionRepository.FindAllWithFilters(ctx, &allTransactionsFilter)
		if err != nil {
			return nil, err
		}

		allTransactionResponses := s.convertToResponseList(allTransactions)
		summary := dto.CalculateSummary(allTransactionResponses, totalCount)

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
			transaction.CreatedAt,
		)
		transactionResponse.BudgetId = transaction.BudgetId
		transactionResponseList = append(transactionResponseList, transactionResponse)
	}
	return transactionResponseList
}

func (s *TransactionService) UpdateTransaction(ctx context.Context, id string, transaction *transaction.Transaction) error {
	if transaction.TypeTransation == BILL {
		transaction.Amount = transaction.Amount * -1
	}

	budget, _ := s.budgetRepository.FindByCategory(ctx, transaction.CategoryId)
	if budget != nil {
		transaction.BudgetId = budget.Id
	}
	err := s.transactionRepository.Update(ctx, id, transaction)
	if err == nil {
		s.cache.DeleteByPrefix(fmt.Sprintf("transactions:user:%s", transaction.UserId))
	}
	return err
}

func (s TransactionService) DeleteTransaction(ctx context.Context, id string, userId string) error {
	err := s.transactionRepository.Delete(ctx, id, userId)
	if err == nil {
		s.cache.DeleteByPrefix(fmt.Sprintf("transactions:user:%s", userId))
	}
	return err
}
