package dto

import (
	"github.com/osmait/gestorDePresupuesto/internal/domain/account"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
)

type AccountResponse struct {
	AccountInfo    *account.Account `json:"account_info"`
	CurrentBalance money.Amount     `json:"current_balance" example:"1250.75"`
}

func NewAccountResponse(accountInfo *account.Account, currentBalance money.Amount) *AccountResponse {
	return &AccountResponse{
		AccountInfo:    accountInfo,
		CurrentBalance: currentBalance,
	}
}
