package dto

type AccountRequest struct {
	Name           string  `json:"name"`
	Bank           string  `json:"bank"`
	InitialBalance float64 `json:"initial_balance"`
}

func NewAccountRequest(name, bank string, initialBalance float64) *AccountRequest {
	return &AccountRequest{
		Name:           name,
		Bank:           bank,
		InitialBalance: initialBalance,
	}
}
