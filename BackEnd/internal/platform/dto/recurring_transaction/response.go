package recurring_transaction

import "time"

type RecurringTransactionResponse struct {
	ID                string     `json:"id"`
	UserID            string     `json:"user_id"`
	Name              string     `json:"name"`
	Description       string     `json:"description"`
	Amount            float64    `json:"amount"`
	Type              string     `json:"type"`
	AccountID         string     `json:"account_id"`
	CategoryID        string     `json:"category_id"`
	BudgetID          *string    `json:"budget_id,omitempty"`
	DayOfMonth        int        `json:"day_of_month"`
	LastExecutionDate *time.Time `json:"last_execution_date,omitempty"`
	CreatedAt         time.Time  `json:"created_at"`
}
