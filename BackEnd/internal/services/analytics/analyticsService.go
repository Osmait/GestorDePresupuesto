package analytics

import (
	"context"
	"fmt"

	"github.com/osmait/gestorDePresupuesto/internal/domain/analytics"
	postgres "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/analytics"
)

func NewAnalyticsService(repo *postgres.AnalyticsRepository) *AnalyticsService {
	return &AnalyticsService{repo: repo}
}

type AnalyticsService struct {
	repo *postgres.AnalyticsRepository
}

func (s *AnalyticsService) GetCategoryExpenses(ctx context.Context, userID string) ([]*analytics.CategoryExpense, error) {
	categoryExpensesRepo, err := s.repo.GetCategoryExpenses(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("error getting category expenses: %w", err)
	}

	var categoryExpenses []*analytics.CategoryExpense

	for _, categoryExpenseRepo := range categoryExpensesRepo {
		categoryExpenses = append(categoryExpenses, &analytics.CategoryExpense{
			ID:    categoryExpenseRepo.CategoryName,
			Label: categoryExpenseRepo.CategoryName,
			Value: categoryExpenseRepo.TotalAmount,
			Color: categoryExpenseRepo.CategoryColor,
		})
	}

	return categoryExpenses, nil
}

func (s *AnalyticsService) GetMonthlySummary(ctx context.Context, userID string) ([]*analytics.MonthlySummary, error) {
	monthlySummariesRepo, err := s.repo.GetMonthlySummary(ctx, userID)
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
