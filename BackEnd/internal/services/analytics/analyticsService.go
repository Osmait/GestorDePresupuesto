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
	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
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
	usdToDopRateFn func(context.Context) (money.Amount, error),
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
	usdToDopRateFn        func(context.Context) (money.Amount, error)
}

type DashboardFilters struct {
	DateFrom        time.Time
	DateTo          time.Time
	AccountID       string
	CategoryID      string
	TransactionType string
	MinAmount       *money.Amount
	MaxAmount       *money.Amount
}

// resolveUsdToDop returns the USD->DOP rate, or 1 (no conversion) when the
// rate is unavailable.
func (s *AnalyticsService) resolveUsdToDop(ctx context.Context) money.Amount {
	if s.usdToDopRateFn == nil {
		log.Warn().Msg("exchange rate function not configured, USD amounts will not be converted")
		return money.FromInt(1)
	}
	rate, rateErr := s.usdToDopRateFn(ctx)
	if rateErr != nil || !rate.IsPositive() {
		log.Warn().Msg("exchange rate unavailable, USD amounts will not be converted")
		return money.FromInt(1)
	}
	return rate
}

// toCategoryExpense maps a repository row, rounding the SQL aggregates
// (sums of amount * rate) half-even to cents for presentation.
func toCategoryExpense(row *analytics.CategoryExpenseRepository) *analytics.CategoryExpense {
	return &analytics.CategoryExpense{
		ID:               row.CategoryID,
		Label:            row.CategoryName,
		Value:            row.TotalAmount.RoundCents(),
		Color:            row.CategoryColor,
		TransactionCount: row.TransactionCount,
		DopTotal:         row.DopTotal.RoundCents(),
		UsdTotal:         row.UsdTotal.RoundCents(),
	}
}

func toMonthlySummary(row *analytics.MonthlySummaryRepository) *analytics.MonthlySummary {
	return &analytics.MonthlySummary{
		Month:    fmt.Sprintf("%d-%02d", row.Year, row.Month),
		Income:   row.TotalIncome.RoundCents(),
		Expenses: row.TotalBill.RoundCents(),
	}
}

func (s *AnalyticsService) GetCategoryExpenses(ctx context.Context, userID string) ([]*analytics.CategoryExpense, error) {
	usdToDop := s.resolveUsdToDop(ctx)

	categoryExpensesRepo, err := s.repo.GetCategoryExpenses(ctx, userID, usdToDop)
	if err != nil {
		return nil, fmt.Errorf("error getting category expenses: %w", err)
	}

	categoryExpenses := make([]*analytics.CategoryExpense, 0)

	for _, categoryExpenseRepo := range categoryExpensesRepo {
		categoryExpenses = append(categoryExpenses, toCategoryExpense(categoryExpenseRepo))
	}

	return categoryExpenses, nil
}

func (s *AnalyticsService) GetMonthlySummary(ctx context.Context, userID string) ([]*analytics.MonthlySummary, error) {
	usdToDop := s.resolveUsdToDop(ctx)

	monthlySummariesRepo, err := s.repo.GetMonthlySummary(ctx, userID, usdToDop)
	if err != nil {
		return nil, fmt.Errorf("error getting monthly summary: %w", err)
	}

	monthlySummaries := make([]*analytics.MonthlySummary, 0)

	for _, monthlySummaryRepo := range monthlySummariesRepo {
		monthlySummaries = append(monthlySummaries, toMonthlySummary(monthlySummaryRepo))
	}

	return monthlySummaries, nil
}

func (s *AnalyticsService) GetDashboardSummary(ctx context.Context, userID string, filters DashboardFilters) (*analytics.DashboardSummary, error) {
	dateFrom, dateTo := normalizeDashboardDateRange(filters.DateFrom, filters.DateTo)
	transactionType := normalizeTransactionType(filters.TransactionType)

	usdToDop := s.resolveUsdToDop(ctx)

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
		categoryExpenses = append(categoryExpenses, toCategoryExpense(categoryExpenseRepo))
	}

	monthlySummaries := make([]*analytics.MonthlySummary, 0)
	for _, monthlySummaryRepo := range monthlySummariesRepo {
		monthlySummaries = append(monthlySummaries, toMonthlySummary(monthlySummaryRepo))
	}

	accountsTotal := money.Zero
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
					accountsTotal = accountsTotal.Add(balances[acc.Id]).Add(acc.InitialBalance)
				}
			}
		}
	}

	investmentsTotalUSD := money.Zero
	investmentsCount := 0
	if s.investmentRepository != nil {
		investments, invErr := s.investmentRepository.FindAll(ctx, userID)
		if invErr == nil {
			investmentsCount = len(investments)
			for _, inv := range investments {
				investmentsTotalUSD = investmentsTotalUSD.Add(inv.Quantity.Mul(inv.CurrentPrice))
			}
		}
	}
	investmentsTotalDOP := investmentsTotalUSD.Mul(usdToDop).RoundCents()

	certificatesTotal := money.Zero
	certificatesCount := 0
	if s.certificateRepository != nil {
		certificates, certErr := s.certificateRepository.FindAll(ctx, userID)
		if certErr == nil {
			totalCapital := money.Zero
			for _, cert := range certificates {
				if cert.Status == certificateDomain.StatusActive {
					totalCapital = totalCapital.Add(cert.BaseCapital)
					certificatesCount++
				}
			}

			payments, payErr := s.certificateRepository.FindAllPayments(ctx, userID)
			if payErr == nil {
				totalNet := money.Zero
				for _, p := range payments {
					totalNet = totalNet.Add(p.NetInterest)
				}
				certificatesTotal = totalCapital.Add(totalNet)
			} else {
				certificatesTotal = totalCapital
			}
		}
	}

	return &analytics.DashboardSummary{
		TotalIncome:       totalsRepo.TotalIncome.RoundCents(),
		TotalExpenses:     totalsRepo.TotalBill.RoundCents(),
		NetAmount:         totalsRepo.TotalIncome.Sub(totalsRepo.TotalBill).RoundCents(),
		UsdToDopRate:      usdToDop,
		AccountsTotal:     accountsTotal.RoundCents(),
		InvestmentsTotal:  investmentsTotalDOP,
		CertificatesTotal: certificatesTotal.RoundCents(),
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
