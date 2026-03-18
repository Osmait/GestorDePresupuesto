package analytics

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/rs/zerolog/log"

	accountDomain "github.com/osmait/gestorDePresupuesto/internal/domain/account"
	"github.com/osmait/gestorDePresupuesto/internal/domain/analytics"
	certificateDomain "github.com/osmait/gestorDePresupuesto/internal/domain/certificate"
	accountRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/account"
	postgres "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/analytics"
	certificateRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/certificate"
	investmentRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/investment"
)

func NewAnalyticsService(
	repo *postgres.AnalyticsRepository,
	accountRepository accountRepo.AccountRepositoryInterface,
	investmentRepository investmentRepo.InvestmentRepoInterface,
	certificateRepository certificateRepo.CertificateRepositoryInterface,
	usdToDopRateFn func(context.Context) (float64, error),
) *AnalyticsService {
	return &AnalyticsService{
		repo:                  repo,
		accountRepository:     accountRepository,
		investmentRepository:  investmentRepository,
		certificateRepository: certificateRepository,
		usdToDopRateFn:        usdToDopRateFn,
	}
}

type AnalyticsService struct {
	repo                  *postgres.AnalyticsRepository
	accountRepository     accountRepo.AccountRepositoryInterface
	investmentRepository  investmentRepo.InvestmentRepoInterface
	certificateRepository certificateRepo.CertificateRepositoryInterface
	usdToDopRateFn        func(context.Context) (float64, error)
}

type DashboardFilters struct {
	DateFrom        time.Time
	DateTo          time.Time
	AccountID       string
	CategoryID      string
	TransactionType string
	MinAmount       *float64
	MaxAmount       *float64
}

func (s *AnalyticsService) GetCategoryExpenses(ctx context.Context, userID string) ([]*analytics.CategoryExpense, error) {
	usdToDop := 1.0 // fallback: no conversion if rate unavailable
	if s.usdToDopRateFn != nil {
		if rate, rateErr := s.usdToDopRateFn(ctx); rateErr == nil && rate > 0 {
			usdToDop = rate
		} else {
			log.Warn().Msg("exchange rate unavailable, USD amounts will not be converted")
		}
	} else {
		log.Warn().Msg("exchange rate function not configured, USD amounts will not be converted")
	}

	categoryExpensesRepo, err := s.repo.GetCategoryExpenses(ctx, userID, usdToDop)
	if err != nil {
		return nil, fmt.Errorf("error getting category expenses: %w", err)
	}

	categoryExpenses := make([]*analytics.CategoryExpense, 0)

	for _, categoryExpenseRepo := range categoryExpensesRepo {
		categoryExpenses = append(categoryExpenses, &analytics.CategoryExpense{
			ID:               categoryExpenseRepo.CategoryID,
			Label:            categoryExpenseRepo.CategoryName,
			Value:            categoryExpenseRepo.TotalAmount,
			Color:            categoryExpenseRepo.CategoryColor,
			TransactionCount: categoryExpenseRepo.TransactionCount,
			DopTotal:         categoryExpenseRepo.DopTotal,
			UsdTotal:         categoryExpenseRepo.UsdTotal,
		})
	}

	return categoryExpenses, nil
}

func (s *AnalyticsService) GetMonthlySummary(ctx context.Context, userID string) ([]*analytics.MonthlySummary, error) {
	usdToDop := 1.0 // fallback: no conversion if rate unavailable
	if s.usdToDopRateFn != nil {
		if rate, rateErr := s.usdToDopRateFn(ctx); rateErr == nil && rate > 0 {
			usdToDop = rate
		} else {
			log.Warn().Msg("exchange rate unavailable, USD amounts will not be converted")
		}
	} else {
		log.Warn().Msg("exchange rate function not configured, USD amounts will not be converted")
	}

	monthlySummariesRepo, err := s.repo.GetMonthlySummary(ctx, userID, usdToDop)
	if err != nil {
		return nil, fmt.Errorf("error getting monthly summary: %w", err)
	}

	monthlySummaries := make([]*analytics.MonthlySummary, 0)

	for _, monthlySummaryRepo := range monthlySummariesRepo {
		monthlySummaries = append(monthlySummaries, &analytics.MonthlySummary{
			Month:    fmt.Sprintf("%d-%02d", monthlySummaryRepo.Year, monthlySummaryRepo.Month),
			Income:   monthlySummaryRepo.TotalIncome,
			Expenses: monthlySummaryRepo.TotalBill,
		})
	}

	return monthlySummaries, nil
}

func (s *AnalyticsService) GetDashboardSummary(ctx context.Context, userID string, filters DashboardFilters) (*analytics.DashboardSummary, error) {
	dateFrom, dateTo := normalizeDashboardDateRange(filters.DateFrom, filters.DateTo)
	transactionType := normalizeTransactionType(filters.TransactionType)

	usdToDop := 1.0 // fallback: no conversion if rate unavailable
	if s.usdToDopRateFn != nil {
		if rate, rateErr := s.usdToDopRateFn(ctx); rateErr == nil && rate > 0 {
			usdToDop = rate
		} else {
			log.Warn().Msg("exchange rate unavailable, USD amounts will not be converted")
		}
	} else {
		log.Warn().Msg("exchange rate function not configured, USD amounts will not be converted")
	}

	categoryExpensesRepo, err := s.repo.GetCategoryExpensesInRange(
		ctx,
		userID,
		usdToDop,
		dateFrom,
		dateTo,
		filters.AccountID,
		filters.CategoryID,
		transactionType,
		filters.MinAmount,
		filters.MaxAmount,
	)
	if err != nil {
		return nil, fmt.Errorf("error getting category expenses: %w", err)
	}

	monthlySummariesRepo, err := s.repo.GetMonthlySummaryInRange(
		ctx,
		userID,
		usdToDop,
		dateFrom,
		dateTo,
		filters.AccountID,
		filters.CategoryID,
		transactionType,
		filters.MinAmount,
		filters.MaxAmount,
	)
	if err != nil {
		return nil, fmt.Errorf("error getting monthly summary: %w", err)
	}

	totalsRepo, err := s.repo.GetTotalsInRange(
		ctx,
		userID,
		usdToDop,
		dateFrom,
		dateTo,
		filters.AccountID,
		filters.CategoryID,
		transactionType,
		filters.MinAmount,
		filters.MaxAmount,
	)
	if err != nil {
		return nil, fmt.Errorf("error getting totals: %w", err)
	}

	categoryExpenses := make([]*analytics.CategoryExpense, 0)
	for _, categoryExpenseRepo := range categoryExpensesRepo {
		categoryExpenses = append(categoryExpenses, &analytics.CategoryExpense{
			ID:               categoryExpenseRepo.CategoryID,
			Label:            categoryExpenseRepo.CategoryName,
			Value:            categoryExpenseRepo.TotalAmount,
			Color:            categoryExpenseRepo.CategoryColor,
			TransactionCount: categoryExpenseRepo.TransactionCount,
			DopTotal:         categoryExpenseRepo.DopTotal,
			UsdTotal:         categoryExpenseRepo.UsdTotal,
		})
	}

	monthlySummaries := make([]*analytics.MonthlySummary, 0)
	for _, monthlySummaryRepo := range monthlySummariesRepo {
		monthlySummaries = append(monthlySummaries, &analytics.MonthlySummary{
			Month:    fmt.Sprintf("%d-%02d", monthlySummaryRepo.Year, monthlySummaryRepo.Month),
			Income:   monthlySummaryRepo.TotalIncome,
			Expenses: monthlySummaryRepo.TotalBill,
		})
	}

	accountsTotal := 0.0
	accountsCount := 0
	if s.accountRepository != nil {
		accounts, accErr := s.accountRepository.FindAll(ctx, userID)
		if accErr == nil {
			balances, balErr := s.accountRepository.Balances(ctx, userID)
			if balErr == nil {
				for _, acc := range accounts {
					if acc.Type == accountDomain.AccountTypeCreditCard {
						continue
					}
					accountsCount++
					accountsTotal += balances[acc.Id] + acc.InitialBalance
				}
			}
		}
	}

	investmentsTotalUSD := 0.0
	investmentsCount := 0
	if s.investmentRepository != nil {
		investments, invErr := s.investmentRepository.FindAll(ctx, userID)
		if invErr == nil {
			investmentsCount = len(investments)
			for _, inv := range investments {
				investmentsTotalUSD += inv.Quantity * inv.CurrentPrice
			}
		}
	}
	investmentsTotalDOP := investmentsTotalUSD * usdToDop

	certificatesTotal := 0.0
	certificatesCount := 0
	if s.certificateRepository != nil {
		certificates, certErr := s.certificateRepository.FindAll(ctx, userID)
		if certErr == nil {
			totalCapital := 0.0
			for _, cert := range certificates {
				if cert.Status == certificateDomain.StatusActive {
					totalCapital += cert.BaseCapital
					certificatesCount++
				}
			}

			payments, payErr := s.certificateRepository.FindAllPayments(ctx, userID)
			if payErr == nil {
				totalNet := 0.0
				for _, p := range payments {
					totalNet += p.NetInterest
				}
				certificatesTotal = totalCapital + totalNet
			} else {
				certificatesTotal = totalCapital
			}
		}
	}

	return &analytics.DashboardSummary{
		TotalIncome:       totalsRepo.TotalIncome,
		TotalExpenses:     totalsRepo.TotalBill,
		NetAmount:         totalsRepo.TotalIncome - totalsRepo.TotalBill,
		UsdToDopRate:      usdToDop,
		AccountsTotal:     accountsTotal,
		InvestmentsTotal:  investmentsTotalDOP,
		CertificatesTotal: certificatesTotal,
		AccountsCount:     accountsCount,
		InvestmentsCount:  investmentsCount,
		CertificatesCount: certificatesCount,
		CategoryExpenses:  categoryExpenses,
		MonthlySummary:    monthlySummaries,
	}, nil
}

func normalizeDashboardDateRange(dateFrom time.Time, dateTo time.Time) (time.Time, time.Time) {
	if dateFrom.IsZero() || dateTo.IsZero() {
		return currentYearRangeInSantoDomingo()
	}

	if dateTo.Before(dateFrom) {
		return dateTo, dateFrom
	}

	return dateFrom, dateTo
}

func normalizeTransactionType(transactionType string) string {
	normalized := strings.ToLower(strings.TrimSpace(transactionType))
	if normalized == "bill" || normalized == "income" {
		return normalized
	}
	return ""
}

func currentYearRangeInSantoDomingo() (time.Time, time.Time) {
	loc, err := time.LoadLocation("America/Santo_Domingo")
	if err != nil {
		now := time.Now()
		start := time.Date(now.Year(), time.January, 1, 0, 0, 0, 0, now.Location())
		return start, now
	}

	now := time.Now().In(loc)
	start := time.Date(now.Year(), time.January, 1, 0, 0, 0, 0, loc)
	return start, now
}
