package recurring_transaction

import "time"

type RecurringTransaction struct {
	ID                string     `json:"id"`
	UserID            string     `json:"user_id"`
	Name              string     `json:"name"`
	Description       string     `json:"description"`
	Amount            float64    `json:"amount"`
	Type              string     `json:"type"` // 'income' or 'expense'
	AccountID         string     `json:"account_id"`
	CategoryID        string     `json:"category_id"`
	BudgetID          *string    `json:"budget_id,omitempty"` // Pointer because it can be null
	DayOfMonth        int        `json:"day_of_month"`
	LastExecutionDate *time.Time `json:"last_execution_date,omitempty"`
	CreatedAt         time.Time  `json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`
}

func NewRecurringTransaction(
	id, userID, name, description string,
	amount float64,
	txnType, accountID, categoryID string,
	budgetID *string,
	dayOfMonth int,
) *RecurringTransaction {
	now := time.Now().UTC()
	return &RecurringTransaction{
		ID:          id,
		UserID:      userID,
		Name:        name,
		Description: description,
		Amount:      amount,
		Type:        txnType,
		AccountID:   accountID,
		CategoryID:  categoryID,
		BudgetID:    budgetID,
		DayOfMonth:  dayOfMonth,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
}
