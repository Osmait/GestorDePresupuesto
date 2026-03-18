package search

import (
	"context"
	"strings"
	// For potential concurrency, though sequential is fine for MVP
	"github.com/osmait/gestorDePresupuesto/internal/domain/account"
	"github.com/osmait/gestorDePresupuesto/internal/domain/budget"
	"github.com/osmait/gestorDePresupuesto/internal/domain/category"
	"github.com/osmait/gestorDePresupuesto/internal/domain/certificate"
	"github.com/osmait/gestorDePresupuesto/internal/domain/transaction"
	"github.com/osmait/gestorDePresupuesto/internal/platform/dto/search"
	dto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/transaction"
	accountRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/account"
	budgetRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/budget"
	categoryRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/category"
	certificateRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/certificate"
	loanRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/loan"
	transactionRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/transaction"
	"github.com/rs/zerolog/log"
)

type SearchService struct {
	transactionRepo transactionRepo.TransactionRepositoryInterface
	categoryRepo    categoryRepo.CategoryRepoInterface
	accountRepo     accountRepo.AccountRepositoryInterface
	budgetRepo      budgetRepo.BudgetRepoInterface
	loanRepo        loanRepo.LoanRepositoryInterface
	certificateRepo certificateRepo.CertificateRepositoryInterface
}

func NewSearchService(
	transactionRepo transactionRepo.TransactionRepositoryInterface,
	categoryRepo categoryRepo.CategoryRepoInterface,
	accountRepo accountRepo.AccountRepositoryInterface,
	budgetRepo budgetRepo.BudgetRepoInterface,
	loanRepo loanRepo.LoanRepositoryInterface,
	certificateRepo certificateRepo.CertificateRepositoryInterface,
) *SearchService {
	return &SearchService{
		transactionRepo: transactionRepo,
		categoryRepo:    categoryRepo,
		accountRepo:     accountRepo,
		budgetRepo:      budgetRepo,
		loanRepo:        loanRepo,
		certificateRepo: certificateRepo,
	}
}

func (s *SearchService) Search(ctx context.Context, userId string, query string) (*search.SearchResponse, error) {
	response := &search.SearchResponse{
		Transactions: []*transaction.Transaction{},
		Categories:   []*category.Category{},
		Accounts:     []*account.Account{},
		Budgets:      []*budget.Budget{},
		Loans:        []*search.SearchLoanItem{},
		Certificates: []*search.SearchCertificateItem{},
	}

	if query == "" {
		return response, nil
	}

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

	// 5. Loans
	loans, err := s.loanRepo.FindAllByUser(ctx, userId)
	if err != nil {
		log.Error().Err(err).Msg("error searching loans")
	} else {
		q := strings.ToLower(strings.TrimSpace(query))
		for _, item := range loans {
			pendingAmount := item.TotalAmount - (item.PaidPrincipal + item.PaidInterest)
			if pendingAmount < 0 {
				pendingAmount = 0
			}

			if strings.Contains(strings.ToLower(item.BorrowerName), q) ||
				strings.Contains(strings.ToLower(item.BorrowerContact), q) ||
				strings.Contains(strings.ToLower(item.Notes), q) {
				response.Loans = append(response.Loans, &search.SearchLoanItem{
					ID:            item.Id,
					BorrowerName:  item.BorrowerName,
					PendingAmount: pendingAmount,
					TotalAmount:   item.TotalAmount,
					Currency:      item.Currency,
					Status:        string(item.Status),
				})
			}
		}
	}

	// 6. Certificates
	certs, err := s.certificateRepo.FindAll(ctx, userId)
	if err != nil {
		log.Error().Err(err).Msg("error searching certificates")
	} else {
		q := strings.ToLower(strings.TrimSpace(query))
		for _, cert := range certs {
			if matchesCertificateSearch(cert, q) {
				response.Certificates = append(response.Certificates, &search.SearchCertificateItem{
					ID:          cert.Id,
					Bank:        cert.Bank,
					BaseCapital: cert.BaseCapital,
					Currency:    cert.Currency,
					Status:      string(cert.Status),
				})
			}
		}
	}

	return response, nil
}

func matchesCertificateSearch(cert *certificate.Certificate, query string) bool {
	if query == "" {
		return false
	}

	return strings.Contains(strings.ToLower(cert.Bank), query) ||
		strings.Contains(strings.ToLower(string(cert.Status)), query) ||
		strings.Contains(strings.ToLower(string(cert.InterestType)), query)
}
