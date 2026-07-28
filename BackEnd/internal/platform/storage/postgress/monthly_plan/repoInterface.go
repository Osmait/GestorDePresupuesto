package monthly_plan

import (
	"context"

	"github.com/osmait/gestorDePresupuesto/internal/domain/monthly_plan"
)

// MonthlyPlanRepoInterface describes the persistence operations needed by the
// monthly plan service. Every method is scoped by user id so one user can never
// reach another user's plan.
type MonthlyPlanRepoInterface interface {
	Save(ctx context.Context, item *monthly_plan.MonthlyPlanItem) error
	FindAllByUser(ctx context.Context, userID string) ([]*monthly_plan.MonthlyPlanItem, error)
	FindOne(ctx context.Context, id string, userID string) (*monthly_plan.MonthlyPlanItem, error)
	Update(ctx context.Context, item *monthly_plan.MonthlyPlanItem) (int64, error)
	SetActive(ctx context.Context, id string, userID string, isActive bool) (int64, error)
	Delete(ctx context.Context, id string, userID string) (int64, error)
	Totals(ctx context.Context, userID string, usdToDop float64) (*monthly_plan.Totals, error)
}
