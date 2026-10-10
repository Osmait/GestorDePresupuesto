package monthly_plan

import (
	"context"

	"github.com/rs/zerolog/log"
	"github.com/segmentio/ksuid"

	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
	"github.com/osmait/gestorDePresupuesto/internal/domain/monthly_plan"
	dto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/monthly_plan"
	monthlyPlanRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/monthly_plan"
	"github.com/osmait/gestorDePresupuesto/internal/services/errorhttp"
)

// fallbackUsdToDopRate is used when the exchange service is unreachable. It
// matches the fallback already used by the budget and transaction services.
var fallbackUsdToDopRate = money.FromInt(60)

// MonthlyPlanService owns the business logic of the user's monthly plan: the
// fixed expenses they committed to and the incomes they expect.
type MonthlyPlanService struct {
	repository     monthlyPlanRepo.MonthlyPlanRepoInterface
	usdToDopRateFn func(context.Context) (money.Amount, error)
}

func NewMonthlyPlanService(
	repo monthlyPlanRepo.MonthlyPlanRepoInterface,
	usdToDopRateFn func(context.Context) (money.Amount, error),
) *MonthlyPlanService {
	return &MonthlyPlanService{
		repository:     repo,
		usdToDopRateFn: usdToDopRateFn,
	}
}

// Create stores a new plan item for the user.
func (s *MonthlyPlanService) Create(ctx context.Context, req *dto.MonthlyPlanItemRequest, userID string) error {
	uuid, err := ksuid.NewRandom()
	if err != nil {
		return err
	}

	item := monthly_plan.NewMonthlyPlanItem(
		uuid.String(),
		userID,
		req.Name,
		req.Description,
		req.Amount,
		req.Currency,
		req.Type,
		normalizeOptionalID(req.CategoryID),
		normalizeOptionalID(req.AccountID),
		req.DayOfMonth,
		req.ActiveOrDefault(),
	)

	return s.repository.Save(ctx, item)
}

// FindAllByUser returns every item of the plan with its DOP equivalent resolved.
func (s *MonthlyPlanService) FindAllByUser(ctx context.Context, userID string) ([]*dto.MonthlyPlanItemResponse, error) {
	items, err := s.repository.FindAllByUser(ctx, userID)
	if err != nil {
		return nil, err
	}

	usdToDop := s.resolveRate(ctx)

	responses := make([]*dto.MonthlyPlanItemResponse, 0, len(items))
	for _, item := range items {
		responses = append(responses, dto.NewMonthlyPlanItemResponse(item, usdToDop))
	}

	return responses, nil
}

// Update rewrites an existing item. It returns errorhttp.ErrNotFound when the
// item does not exist or belongs to another user — the repository scopes the
// UPDATE by user id, so a mismatch simply affects no rows.
func (s *MonthlyPlanService) Update(ctx context.Context, req *dto.MonthlyPlanItemRequest, id string, userID string) error {
	item := monthly_plan.NewMonthlyPlanItem(
		id,
		userID,
		req.Name,
		req.Description,
		req.Amount,
		req.Currency,
		req.Type,
		normalizeOptionalID(req.CategoryID),
		normalizeOptionalID(req.AccountID),
		req.DayOfMonth,
		req.ActiveOrDefault(),
	)

	rowsAffected, err := s.repository.Update(ctx, item)
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return errorhttp.ErrNotFound
	}

	return nil
}

// SetActive pauses or resumes an item without deleting it.
func (s *MonthlyPlanService) SetActive(ctx context.Context, id string, userID string, isActive bool) error {
	rowsAffected, err := s.repository.SetActive(ctx, id, userID, isActive)
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return errorhttp.ErrNotFound
	}

	return nil
}

// Delete removes an item belonging to the user.
func (s *MonthlyPlanService) Delete(ctx context.Context, id string, userID string) error {
	rowsAffected, err := s.repository.Delete(ctx, id, userID)
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return errorhttp.ErrNotFound
	}

	return nil
}

// Summary is the point of the whole feature: how much comes in every month, how
// much is already committed to fixed expenses, and what is actually left.
func (s *MonthlyPlanService) Summary(ctx context.Context, userID string) (*dto.MonthlyPlanSummaryResponse, error) {
	usdToDop := s.resolveRate(ctx)

	totals, err := s.repository.Totals(ctx, userID, usdToDop)
	if err != nil {
		return nil, err
	}

	summary := &monthly_plan.Summary{
		TotalIncome:         totals.TotalIncome.RoundCents(),
		TotalExpenses:       totals.TotalExpenses.RoundCents(),
		Available:           totals.TotalIncome.Sub(totals.TotalExpenses).RoundCents(),
		CommittedPercentage: committedPercentage(totals.TotalIncome, totals.TotalExpenses),
		UsdToDopRate:        usdToDop,
		IncomeCount:         totals.IncomeCount,
		ExpensesCount:       totals.ExpensesCount,
	}

	return dto.NewMonthlyPlanSummaryResponse(summary), nil
}

// committedPercentage is the share of the expected income already taken by fixed
// expenses. With no income there is nothing to divide by, so it reports 0 rather
// than infinity. It is a display-only ratio: computed in decimal, rounded
// half-even to 2 places, returned as float64.
func committedPercentage(totalIncome money.Amount, totalExpenses money.Amount) float64 {
	if !totalIncome.IsPositive() {
		return 0
	}
	return money.Percent(totalExpenses, totalIncome)
}

// resolveRate fetches the USD→DOP rate, falling back to a fixed value when the
// exchange service is unavailable so the plan still renders.
func (s *MonthlyPlanService) resolveRate(ctx context.Context) money.Amount {
	if s.usdToDopRateFn == nil {
		return fallbackUsdToDopRate
	}

	rate, err := s.usdToDopRateFn(ctx)
	if err != nil || !rate.IsPositive() {
		log.Warn().Msg("exchange rate unavailable for monthly plan, using fallback rate")
		return fallbackUsdToDopRate
	}

	return rate
}

// normalizeOptionalID turns an empty string pointer into nil so the column is
// stored as NULL instead of an empty foreign key that would fail the constraint.
func normalizeOptionalID(id *string) *string {
	if id == nil || *id == "" {
		return nil
	}
	return id
}
