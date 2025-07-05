package dto

import "github.com/osmait/gestorDePresupuesto/internal/domain/account"

type AccountResponse struct {
	AccountInfo    *account.Account `json:"account_info"`
	CurrentBalance float64          `json:"current_balance"`
}

func NewAccountResponse(accountInfo *account.Account, currentBalance float64) *AccountResponse {
	return &AccountResponse{
		AccountInfo:    accountInfo,
		CurrentBalance: currentBalance,
	}
}
