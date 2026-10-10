package recurring_transaction

import "github.com/osmait/gestorDePresupuesto/internal/domain/money"

type RecurringTransactionRequest struct {
	Name        string       `json:"name" binding:"required"`
	Description string       `json:"description"`
	Amount      money.Amount `json:"amount" binding:"required"`
	Type        string       `json:"type" binding:"required,oneof=income bill"`
	AccountID   string       `json:"account_id" binding:"required"`
	CategoryID  string       `json:"category_id" binding:"required"`
	BudgetID    *string      `json:"budget_id"`
	DayOfMonth  int          `json:"day_of_month" binding:"required,min=1,max=31"`
}

// Validate rejects an amount with more decimals than
// recurring_transactions.amount (NUMERIC(15,2)) stores.
func (r *RecurringTransactionRequest) Validate() error {
	return money.CheckCents("amount", r.Amount)
}
