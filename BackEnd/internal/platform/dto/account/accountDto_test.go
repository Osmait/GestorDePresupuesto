package dto

import (
	"testing"

	"github.com/go-playground/assert/v2"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money/moneytest"
	"github.com/osmait/gestorDePresupuesto/internal/platform/utils"
)

func TestAccountRequest(t *testing.T) {
	account := utils.GetNewRandomAccount()
	accountRequest := NewAccountRequest(account.Name, account.Bank, account.InitialBalance)
	assert.Equal(t, account.Name, accountRequest.Name)
	assert.Equal(t, account.Bank, accountRequest.Bank)
	moneytest.Equal(t, account.InitialBalance, accountRequest.InitialBalance)
}

func TestAccountResponse(t *testing.T) {
	account := utils.GetNewRandomAccount()
	balance := money.FromInt(1000)
	accountResponse := NewAccountResponse(account, balance)
	assert.Equal(t, account.Name, accountResponse.AccountInfo.Name)
	assert.Equal(t, account.Bank, accountResponse.AccountInfo.Bank)
}
