package account

import "time"

type Account struct {
	Id             string    `json:"id" example:"acc_123456789"`
	Name           string    `json:"name" example:"My Savings Account"`
	Bank           string    `json:"bank" example:"Bank of America"`
	UserId         string    `json:"user_id" example:"user_987654321"`
	InitialBalance float64   `json:"initial_balance" example:"1000.50"`
	CreatedAt      time.Time `json:"created_at" example:"2024-01-15T10:30:00Z"`
}

func NewAccount(balance float64, id string, name string, bank string) *Account {
	return &Account{
		Id:             id,
		Name:           name,
		Bank:           bank,
		InitialBalance: balance,
	}
}
