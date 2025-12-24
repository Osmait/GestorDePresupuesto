package dto

// AccountUpdateRequest represents the data required to update an existing account.
// Only name and bank can be updated - balance and creation date remain unchanged.
type AccountUpdateRequest struct {
	Name string `json:"name" validate:"required,min=2,max=100,printascii" binding:"required" example:"Updated Savings Account"`
	Bank string `json:"bank" validate:"required,min=2,max=100,printascii" binding:"required" example:"Updated Bank Name"`
}

// NewAccountUpdateRequest creates a new AccountUpdateRequest with the provided information.
// This constructor ensures proper initialization of the update request object.
func NewAccountUpdateRequest(name, bank string) *AccountUpdateRequest {
	return &AccountUpdateRequest{
		Name: name,
		Bank: bank,
	}
}

// Validate performs business logic validation on the AccountUpdateRequest.
// It checks for additional constraints beyond basic field validation.
func (a *AccountUpdateRequest) Validate() error {
	// Additional custom validation logic can be added here
	// e.g., valid bank names, prohibited names, etc.
	return nil
}
