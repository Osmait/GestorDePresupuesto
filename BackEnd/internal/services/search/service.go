package search

import (
	"context"
	// For potential concurrency, though sequential is fine for MVP
	"github.com/osmait/gestorDePresupuesto/internal/domain/account"
	"github.com/osmait/gestorDePresupuesto/internal/domain/budget"
	"github.com/osmait/gestorDePresupuesto/internal/domain/category"
	"github.com/osmait/gestorDePresupuesto/internal/domain/transaction"
	"github.com/osmait/gestorDePresupuesto/internal/platform/dto/search"
	dto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/transaction"
	accountRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/account"
	budgetRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/budget"
	categoryRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/category"
	transactionRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/transaction"
	"github.com/rs/zerolog/log"
)

type SearchService struct {
	transactionRepo transactionRepo.TransactionRepositoryInterface
	categoryRepo    categoryRepo.CategoryRepoInterface
	accountRepo     accountRepo.AccountRepositoryInterface
	budgetRepo      budgetRepo.BudgetRepoInterface
}

func NewSearchService(
	transactionRepo transactionRepo.TransactionRepositoryInterface,
	categoryRepo categoryRepo.CategoryRepoInterface,
	accountRepo accountRepo.AccountRepositoryInterface,
	budgetRepo budgetRepo.BudgetRepoInterface,
) *SearchService {
	return &SearchService{
		transactionRepo: transactionRepo,
		categoryRepo:    categoryRepo,
		accountRepo:     accountRepo,
		budgetRepo:      budgetRepo,
	}
}

func (s *SearchService) Search(ctx context.Context, userId string, query string) (*search.SearchResponse, error) {
	response := &search.SearchResponse{
		Transactions: []*transaction.Transaction{},
		Categories:   []*category.Category{},
		Accounts:     []*account.Account{},
		Budgets:      []*budget.Budget{},
	}

	if query == "" {
		return response, nil
	}

	// 1. Search Transactions
	go func() {
		// Use existing filter logic
		filter := dto.NewTransactionFilter()
		filter.Search = query
		// We want all matches, maybe limit? Default limit is usually set in DTO, let's say 50.
		// filter.Limit = 50

		txs, err := s.transactionRepo.FindAllOfAllAccountsWithFilters(ctx, userId, filter)
		if err != nil {
			log.Error().Err(err).Msg("error searching transactions")
		} else {
			response.Transactions = txs
		}
	}()

	// Since we are using pointers to response fields inside goroutines without mutex, this is unsafe if concurrent.
	// Let's run sequentially for safety and simplicity first, or use channels/waitgroup correctly.
	// Sequential is fast enough for <100ms DB queries.

	// 1. Transactions
	filter := dto.NewTransactionFilter()
	filter.Search = query
	txs, err := s.transactionRepo.FindAllOfAllAccountsWithFilters(ctx, userId, filter)
	if err != nil {
		log.Error().Err(err).Msg("error searching transactions")
		// Don't fail entire request, just log? Or fail? Usually partial results are better, but let's log.
	} else {
		response.Transactions = txs
	}

	// 2. Categories
	cats, err := s.categoryRepo.Search(ctx, userId, query)
	if err != nil {
		log.Error().Err(err).Msg("error searching categories")
	} else {
		response.Categories = cats
	}

	// 3. Accounts
	accs, err := s.accountRepo.Search(ctx, userId, query)
	if err != nil {
		log.Error().Err(err).Msg("error searching accounts")
	} else {
		response.Accounts = accs
	}

	// 4. Budgets
	buds, err := s.budgetRepo.Search(ctx, userId, query)
	if err != nil {
		log.Error().Err(err).Msg("error searching budgets")
	} else {
		response.Budgets = buds
	}

	return response, nil
}
