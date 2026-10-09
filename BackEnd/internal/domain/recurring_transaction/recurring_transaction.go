package recurring_transaction

import (
	"time"

	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
)

type RecurringTransaction struct {
	ID                string       `json:"id"`
	UserID            string       `json:"user_id"`
	Name              string       `json:"name"`
	Description       string       `json:"description"`
	Amount            money.Amount `json:"amount"`
	Type              string       `json:"type"` // 'income' or 'bill'
	AccountID         string       `json:"account_id"`
	CategoryID        string       `json:"category_id"`
	BudgetID          *string      `json:"budget_id,omitempty"` // Pointer because it can be null
	DayOfMonth        int          `json:"day_of_month"`
	LastExecutionDate *time.Time   `json:"last_execution_date,omitempty"`
	// NextExecutionDate is the calendar date (midnight UTC, interpreted in the
	// application time zone) of the next occurrence to execute.
	NextExecutionDate *time.Time `json:"next_execution_date,omitempty"`
	CreatedAt         time.Time  `json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`
}

func NewRecurringTransaction(
	id, userID, name, description string,
	amount money.Amount,
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
