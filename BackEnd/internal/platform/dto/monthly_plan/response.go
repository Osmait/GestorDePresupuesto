package monthly_plan

import (
	"time"

	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
	"github.com/osmait/gestorDePresupuesto/internal/domain/monthly_plan"
)

// MonthlyPlanItemResponse is a single plan item as returned by the API.
type MonthlyPlanItemResponse struct {
	CreatedAt   time.Time    `json:"created_at"`
	CategoryID  *string      `json:"category_id,omitempty"`
	AccountID   *string      `json:"account_id,omitempty"`
	DayOfMonth  *int         `json:"day_of_month,omitempty"`
	ID          string       `json:"id"`
	UserID      string       `json:"user_id"`
	Name        string       `json:"name"`
	Description string       `json:"description"`
	Currency    string       `json:"currency"`
	Type        string       `json:"type"`
	Amount      money.Amount `json:"amount"`
	// AmountDop is Amount converted to DOP, so the client never has to apply
	// the exchange rate itself.
	AmountDop money.Amount `json:"amount_dop"`
	IsActive  bool         `json:"is_active"`
}

// MonthlyPlanSummaryResponse is the totals card of the feature. Every amount is
// expressed in DOP.
type MonthlyPlanSummaryResponse struct {
	TotalIncome         money.Amount `json:"total_income"`
	TotalExpenses       money.Amount `json:"total_expenses"`
	Available           money.Amount `json:"available"`
	CommittedPercentage float64      `json:"committed_percentage"`
	UsdToDopRate        money.Amount `json:"usd_to_dop_rate"`
	IncomeCount         int          `json:"income_count"`
	ExpensesCount       int          `json:"expenses_count"`
}

// NewMonthlyPlanItemResponse maps a domain item to its API representation,
// converting USD amounts with the supplied rate.
func NewMonthlyPlanItemResponse(item *monthly_plan.MonthlyPlanItem, usdToDop money.Amount) *MonthlyPlanItemResponse {
	amountDop := item.Amount
	if item.Currency == monthly_plan.CurrencyUSD {
		amountDop = item.Amount.Mul(usdToDop).RoundCents()
	}

	return &MonthlyPlanItemResponse{
		ID:          item.ID,
		UserID:      item.UserID,
		Name:        item.Name,
		Description: item.Description,
		Amount:      item.Amount,
		AmountDop:   amountDop,
		Currency:    item.Currency,
		Type:        item.Type,
		CategoryID:  item.CategoryID,
		AccountID:   item.AccountID,
		DayOfMonth:  item.DayOfMonth,
		IsActive:    item.IsActive,
		CreatedAt:   item.CreatedAt,
	}
}

// NewMonthlyPlanSummaryResponse maps a domain summary to its API representation.
func NewMonthlyPlanSummaryResponse(summary *monthly_plan.Summary) *MonthlyPlanSummaryResponse {
	return &MonthlyPlanSummaryResponse{
		TotalIncome:         summary.TotalIncome,
		TotalExpenses:       summary.TotalExpenses,
		Available:           summary.Available,
		CommittedPercentage: summary.CommittedPercentage,
		UsdToDopRate:        summary.UsdToDopRate,
		IncomeCount:         summary.IncomeCount,
		ExpensesCount:       summary.ExpensesCount,
	}
}
