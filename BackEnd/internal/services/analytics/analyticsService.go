package analytics

import (
	"context"
	"fmt"
	"time"

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

func (s *AnalyticsService) GetCategoryExpenses(ctx context.Context, userID string) ([]*analytics.CategoryExpense, error) {
	usdToDop := 60.0
	if s.usdToDopRateFn != nil {
		if rate, rateErr := s.usdToDopRateFn(ctx); rateErr == nil && rate > 0 {
			usdToDop = rate
		}
	}

	categoryExpensesRepo, err := s.repo.GetCategoryExpenses(ctx, userID, usdToDop)
	if err != nil {
		return nil, fmt.Errorf("error getting category expenses: %w", err)
	}

	var categoryExpenses []*analytics.CategoryExpense

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
	usdToDop := 60.0
	if s.usdToDopRateFn != nil {
		if rate, rateErr := s.usdToDopRateFn(ctx); rateErr == nil && rate > 0 {
			usdToDop = rate
		}
	}

	monthlySummariesRepo, err := s.repo.GetMonthlySummary(ctx, userID, usdToDop)
	if err != nil {
		return nil, fmt.Errorf("error getting monthly summary: %w", err)
	}

	var monthlySummaries []*analytics.MonthlySummary

	for _, monthlySummaryRepo := range monthlySummariesRepo {
		monthlySummaries = append(monthlySummaries, &analytics.MonthlySummary{
			Month:    fmt.Sprintf("%d-%02d", monthlySummaryRepo.Year, monthlySummaryRepo.Month),
			Income:   monthlySummaryRepo.TotalIncome,
			Expenses: monthlySummaryRepo.TotalBill,
		})
	}

	return monthlySummaries, nil
}

func (s *AnalyticsService) GetDashboardSummary(ctx context.Context, userID string) (*analytics.DashboardSummary, error) {
	dateFrom, dateTo := currentYearRangeInSantoDomingo()

	usdToDop := 60.0
	if s.usdToDopRateFn != nil {
		if rate, rateErr := s.usdToDopRateFn(ctx); rateErr == nil && rate > 0 {
			usdToDop = rate
		}
	}

	categoryExpensesRepo, err := s.repo.GetCategoryExpensesInRange(ctx, userID, usdToDop, dateFrom, dateTo)
	if err != nil {
		return nil, fmt.Errorf("error getting category expenses: %w", err)
	}

	monthlySummariesRepo, err := s.repo.GetMonthlySummaryInRange(ctx, userID, usdToDop, dateFrom, dateTo)
	if err != nil {
		return nil, fmt.Errorf("error getting monthly summary: %w", err)
	}

	totalsRepo, err := s.repo.GetTotalsInRange(ctx, userID, usdToDop, dateFrom, dateTo)
	if err != nil {
		return nil, fmt.Errorf("error getting totals: %w", err)
	}

	var categoryExpenses []*analytics.CategoryExpense
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

	var monthlySummaries []*analytics.MonthlySummary
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
			accountsCount = len(accounts)
			balances, balErr := s.accountRepository.Balances(ctx, userID)
			if balErr == nil {
				for _, account := range accounts {
					accountsTotal += balances[account.Id] + account.InitialBalance
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
