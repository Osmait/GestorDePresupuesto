package monthly_plan

import "github.com/osmait/gestorDePresupuesto/internal/domain/money"

// MonthlyPlanItemRequest is the payload accepted when creating or updating a
// plan item. Gin's binding tags reject bad input before it reaches the service.
type MonthlyPlanItemRequest struct {
	CategoryID  *string      `json:"category_id"`
	AccountID   *string      `json:"account_id"`
	DayOfMonth  *int         `json:"day_of_month" binding:"omitempty,min=1,max=31"`
	IsActive    *bool        `json:"is_active"`
	Name        string       `json:"name" binding:"required"`
	Description string       `json:"description"`
	Currency    string       `json:"currency" binding:"omitempty,oneof=DOP USD"`
	Type        string       `json:"type" binding:"required,oneof=income bill"`
	Amount      money.Amount `json:"amount" binding:"required,gt=0"`
}

// Validate rejects an amount with more decimals than monthly_plan_items.amount
// (NUMERIC(15,2)) stores.
func (r *MonthlyPlanItemRequest) Validate() error {
	return money.CheckCents("amount", r.Amount)
}

// ActiveOrDefault reports whether the item should be active, defaulting to true
// when the client omits the field.
func (r *MonthlyPlanItemRequest) ActiveOrDefault() bool {
	if r.IsActive == nil {
		return true
	}
	return *r.IsActive
}

// MonthlyPlanToggleRequest pauses or resumes an item. IsActive is a pointer so a
// missing field is rejected by the binding rather than silently read as false.
type MonthlyPlanToggleRequest struct {
	IsActive *bool `json:"is_active" binding:"required"`
}
