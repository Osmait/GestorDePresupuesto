package dto

import (
	"time"

	"github.com/osmait/gestorDePresupuesto/internal/domain/account"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
)

type AccountResponse struct {
	AccountInfo    *account.Account `json:"account_info"`
	CurrentBalance money.Amount     `json:"current_balance" example:"1250.75"`
	// LastReconciledAt is when the account was last checked against the
	// bank's balance (POST /account/:id/reconcile); absent if never.
	LastReconciledAt *time.Time `json:"last_reconciled_at,omitempty" example:"2026-10-29T21:00:00Z"`
}

func NewAccountResponse(accountInfo *account.Account, currentBalance money.Amount) *AccountResponse {
	return &AccountResponse{
		AccountInfo:    accountInfo,
		CurrentBalance: currentBalance,
	}
}
