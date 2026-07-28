// Package monthly_plan holds the entities for the user's monthly plan: the
// fixed expenses they are committed to and the incomes they expect every month.
//
// These items are deliberately independent from the transactions table. They
// describe intent, not history, and are never turned into real transactions
// (that is what recurring_transaction does). Their purpose is visual control:
// how much of my expected income is already committed before the month starts.
package monthly_plan

import "time"

// Item types. These match the vocabulary used by the transactions table
// ('bill' rather than 'expense') so the whole codebase stays consistent.
const (
	TypeIncome = "income"
	TypeBill   = "bill"
)

// Supported currencies, mirroring the rest of the application.
const (
	CurrencyDOP = "DOP"
	CurrencyUSD = "USD"
)

// MonthlyPlanItem is a single line of the plan: one fixed expense or one
// expected income.
type MonthlyPlanItem struct {
	CreatedAt   time.Time
	UpdatedAt   time.Time
	CategoryID  *string
	AccountID   *string
	DayOfMonth  *int
	ID          string
	UserID      string
	Name        string
	Description string
	Currency    string
	Type        string
	Amount      float64
	IsActive    bool
}

// NewMonthlyPlanItem builds an item with its timestamps already set. An empty
// currency defaults to DOP so callers that do not care about currency keep
// working.
func NewMonthlyPlanItem(
	id, userID, name, description string,
	amount float64,
	currency, itemType string,
	categoryID, accountID *string,
	dayOfMonth *int,
	isActive bool,
) *MonthlyPlanItem {
	now := time.Now().UTC()
	if currency == "" {
		currency = CurrencyDOP
	}

	return &MonthlyPlanItem{
		ID:          id,
		UserID:      userID,
		Name:        name,
		Description: description,
		Amount:      amount,
		Currency:    currency,
		Type:        itemType,
		CategoryID:  categoryID,
		AccountID:   accountID,
		DayOfMonth:  dayOfMonth,
		IsActive:    isActive,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
}

// Totals is the raw aggregation returned by the repository, already converted
// to DOP.
type Totals struct {
	TotalIncome   float64
	TotalExpenses float64
	IncomeCount   int
	ExpensesCount int
}

// Summary is the headline of the feature: what comes in, what is already
// committed, and what is actually left.
type Summary struct {
	TotalIncome   float64
	TotalExpenses float64
	// Available is income minus expenses. It can be negative, which is exactly
	// the situation the user needs to see.
	Available float64
	// CommittedPercentage is the share of the expected income already taken by
	// fixed expenses. Zero when there is no income to compare against.
	CommittedPercentage float64
	UsdToDopRate        float64
	IncomeCount         int
	ExpensesCount       int
}
