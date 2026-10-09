package dto

import (
	"errors"

	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
)

// AccountRequest represents the data required to create a new account.
// All fields are validated for financial data security and business rules.
// InitialBalance is deliberately not `binding:"required"`: validator treats 0
// as "missing", which rejected accounts opened with a zero balance. Negative
// balances are rejected by Validate. Name and Bank are capped at the
// VARCHAR(255) column size so overlong input is a 400, not a database 500.
type AccountRequest struct {
	Name           string       `json:"name" validate:"required,min=2,max=100,printascii" binding:"required,max=255" example:"My Savings Account"`
	Bank           string       `json:"bank" validate:"required,min=2,max=100,printascii" binding:"required,max=255" example:"Bank of America"`
	InitialBalance money.Amount `json:"initial_balance" validate:"min=0,max=999999999.99" example:"1000.50"`
}

// NewAccountRequest creates a new AccountRequest with the provided information.
// This constructor ensures proper initialization of the request object.
func NewAccountRequest(name, bank string, initialBalance money.Amount) *AccountRequest {
	return &AccountRequest{
		Name:           name,
		Bank:           bank,
		InitialBalance: initialBalance,
	}
}

// Validate performs business logic validation on the AccountRequest.
// It checks for additional constraints beyond basic field validation.
func (a *AccountRequest) Validate() error {
	if a.InitialBalance.IsNegative() {
		return errors.New("initial balance cannot be negative")
	}
	return nil
}
