package recurring_transaction

type RecurringTransactionRequest struct {
	Name        string  `json:"name" binding:"required"`
	Description string  `json:"description"`
	Amount      float64 `json:"amount" binding:"required"`
	Type        string  `json:"type" binding:"required,oneof=income bill"`
	AccountID   string  `json:"account_id" binding:"required"`
	CategoryID  string  `json:"category_id" binding:"required"`
	BudgetID    *string `json:"budget_id"`
	DayOfMonth  int     `json:"day_of_month" binding:"required,min=1,max=31"`
}
