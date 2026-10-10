package account

import (
	"time"

	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
)

type AccountType string

const (
	AccountTypeBank       AccountType = "bank"
	AccountTypeCreditCard AccountType = "credit_card"
)

type Account struct {
	Id             string       `json:"id" example:"acc_123456789"`
	Name           string       `json:"name" example:"My Savings Account"`
	Bank           string       `json:"bank" example:"Bank of America"`
	UserId         string       `json:"user_id" example:"user_987654321"`
	InitialBalance money.Amount `json:"initial_balance" example:"1000.50"`
	Type           AccountType  `json:"type" example:"bank"`
	Currency       string       `json:"currency" example:"DOP"`
	CreatedAt      time.Time    `json:"created_at" example:"2024-01-15T10:30:00Z"`
}

func NewAccount(balance money.Amount, id string, name string, bank string) *Account {
	return &Account{
		Id:             id,
		Name:           name,
		Bank:           bank,
		InitialBalance: balance,
		Type:           AccountTypeBank,
		Currency:       "DOP",
	}
}

func NewCreditCardAccount(id string, name string, bank string) *Account {
	return &Account{
		Id:             id,
		Name:           name,
		Bank:           bank,
		InitialBalance: money.Zero,
		Type:           AccountTypeCreditCard,
		Currency:       "DOP",
	}
}
