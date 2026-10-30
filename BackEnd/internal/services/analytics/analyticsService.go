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
	"github.com/osmait/gestorDePresupuesto/internal/platform/apptime"
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
	opts ...Option,
) *AnalyticsService {
	s := &AnalyticsService{
		repo:                  repo,
		accountRepository:     accountRepository,
		investmentRepository:  investmentRepository,
		certificateRepository: certificateRepository,
		usdToDopRateFn:        usdToDopRateFn,
	}
	for _, opt := range opts {
		opt(s)
	}
	return s
}

// Option configures an AnalyticsService.
type Option func(*AnalyticsService)

// WithLocation sets the app time zone that the calendar days of dashboard
// ranges are cut in (default apptime.Default()).
func WithLocation(loc *time.Location) Option {
	return func(s *AnalyticsService) {
		if loc != nil {
			s.loc = loc
		}
	}
}

type AnalyticsService struct {
	repo                  *postgres.AnalyticsRepository
	accountRepository     accountRepo.AccountRepositoryInterface
	investmentRepository  investmentRepo.InvestmentRepoInterface
	certificateRepository certificateRepo.CertificateRepositoryInterface
	usdToDopRateFn        func(context.Context) (money.Amount, error)
	loc                   *time.Location
}

// DashboardFilters selects the transactions aggregated by GetDashboardSummary.
//
// DateFrom and DateTo are the first and the last calendar day of the range,
// both inclusive: only their year, month and day (in their own location) are
// used. When either is zero the range is the current year to date in the app
// time zone. See dashboardDateRange for the instants they select.
type DashboardFilters struct {
	DateFrom        time.Time
	DateTo          time.Time
	AccountID       string
	CategoryID      string
	TransactionType string
	MinAmount       *money.Amount
	MaxAmount       *money.Amount
}

// resolveUsdToDop returns the USD->DOP rate, or money.FallbackUsdToDopRate
// (60, the fallback of the other modules) when the rate is unavailable.
func (s *AnalyticsService) resolveUsdToDop(ctx context.Context) money.Amount {
	if s.usdToDopRateFn == nil {
		log.Warn().Msg("exchange rate function not configured, using fallback rate 60")
		return money.FallbackUsdToDopRate
	}
	rate, rateErr := s.usdToDopRateFn(ctx)
	if rateErr != nil || !rate.IsPositive() {
		log.Warn().Err(rateErr).Msg("exchange rate unavailable, using fallback rate 60")
		return money.FallbackUsdToDopRate
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
	dateFrom, dateToExclusive := dashboardDateRange(filters.DateFrom, filters.DateTo, time.Now(), apptime.OrDefault(s.loc))
	transactionType := normalizeTransactionType(filters.TransactionType)

	usdToDop := s.resolveUsdToDop(ctx)

	categoryExpensesRepo, err := s.repo.GetCategoryExpensesInRange(
		ctx,
		userID,
		usdToDop,
		dateFrom,
		dateToExclusive,
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
		dateToExclusive,
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
		dateToExclusive,
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
	creditCardDebt := money.Zero
	creditCardsCount := 0
	if s.accountRepository != nil {
		accounts, accErr := s.accountRepository.FindAll(ctx, userID)
		if accErr == nil {
			balances, balErr := s.accountRepository.Balances(ctx, userID)
			if balErr == nil {
				for _, acc := range accounts {
					if acc.Type == accountDomain.AccountTypeCreditCard {
						creditCardsCount++
						creditCardDebt = creditCardDebt.Add(s.cardDebtDOP(ctx, acc.Id, userID, usdToDop))
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
		CreditCardDebt:    creditCardDebt.RoundCents(),
		CreditCardsCount:  creditCardsCount,
		AccountsCount:     accountsCount,
		InvestmentsCount:  investmentsCount,
		CertificatesCount: certificatesCount,
		CategoryExpenses:  categoryExpenses,
		MonthlySummary:    monthlySummaries,
	}, nil
}

// cardDebtDOP is what the user owes on card cardId (the negative part of its
// ledger balance per currency), in DOP. A card in credit counts as no debt.
func (s *AnalyticsService) cardDebtDOP(ctx context.Context, cardId, userID string, usdToDop money.Amount) money.Amount {
	debt := money.Zero
	for _, currency := range []string{"DOP", "USD"} {
		balance, err := s.accountRepository.BalanceByCurrency(ctx, cardId, userID, currency)
		if err != nil || !balance.IsNegative() {
			continue
		}
		owed := balance.Neg()
		if currency == "USD" {
			owed = owed.Mul(usdToDop)
		}
		debt = debt.Add(owed)
	}
	return debt
}

// dashboardDateRange returns the half-open range of instants [from, to) of
// the inclusive calendar days [dateFrom, dateTo] in loc (the app time zone):
// from 00:00 local of the first day to 00:00 local of the day after the last
// one, so the whole last day is included. These are the same local days as
// the transaction list (TransactionFilter cuts date_from/date_to in the app
// time zone) and the same months as the monthly rollup (bucketed by
// app_timezone(), migration 000062), so the same period gives the same totals
// on every screen and a range of whole months is served from the rollup. A
// reversed range is swapped; a zero bound selects the current year to date.
func dashboardDateRange(dateFrom, dateTo, now time.Time, loc *time.Location) (time.Time, time.Time) {
	if dateFrom.IsZero() || dateTo.IsZero() {
		dateFrom, dateTo = apptime.StartOfYear(now, loc), now.In(loc)
	}

	from, to := localDay(dateFrom, loc), localDay(dateTo, loc)
	if to.Before(from) {
		from, to = to, from
	}

	return from, to.AddDate(0, 0, 1)
}

// localDay returns 00:00 in loc of t's calendar day (year, month and day of t
// in its own location).
func localDay(t time.Time, loc *time.Location) time.Time {
	year, month, day := t.Date()
	return apptime.Date(year, month, day, loc)
}

func normalizeTransactionType(transactionType string) string {
	normalized := strings.ToLower(strings.TrimSpace(transactionType))
	if normalized == "bill" || normalized == "income" {
		return normalized
	}
	return ""
}
