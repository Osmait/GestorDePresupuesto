package dto

// AccountRequest represents the data required to create a new account.
// All fields are validated for financial data security and business rules.
type AccountRequest struct {
	Name           string  `json:"name" validate:"required,min=2,max=100,printascii" binding:"required" example:"My Savings Account"`
	Bank           string  `json:"bank" validate:"required,min=2,max=100,printascii" binding:"required" example:"Bank of America"`
	InitialBalance float64 `json:"initial_balance" validate:"min=0,max=999999999.99" binding:"required" example:"1000.50"`
}

// NewAccountRequest creates a new AccountRequest with the provided information.
// This constructor ensures proper initialization of the request object.
func NewAccountRequest(name, bank string, initialBalance float64) *AccountRequest {
	return &AccountRequest{
		Name:           name,
		Bank:           bank,
		InitialBalance: initialBalance,
	}
}

// Validate performs business logic validation on the AccountRequest.
// It checks for additional constraints beyond basic field validation.
func (a *AccountRequest) Validate() error {
	// Additional custom validation logic can be added here
	// e.g., valid bank names, balance limits, etc.
	return nil
}
