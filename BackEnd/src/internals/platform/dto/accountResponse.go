package dto

import "github.com/osmait/gestorDePresupuesto/src/internals/domain/account"

type AccountResponse struct {
	AccountInfo    *account.Account
	CurrentBalance float64
}

func NewAccountResponse(accountInfo *account.Account, currentBalance float64) *AccountResponse {
	return &AccountResponse{
		AccountInfo:    accountInfo,
		CurrentBalance: currentBalance,
	}
}
