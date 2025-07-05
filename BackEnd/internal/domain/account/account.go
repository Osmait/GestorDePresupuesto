package account

import "time"

type Account struct {
	Id             string    `json:"id"`
	Name           string    `json:"name"`
	Bank           string    `json:"bank"`
	UserId         string    `json:"user_id"`
	InitialBalance float64   `json:"initial_balance"`
	CreatedAt      time.Time `json:"created_at"`
}

func NewAccount(balance float64, id string, name string, bank string) *Account {
	return &Account{
		Id:             id,
		Name:           name,
		Bank:           bank,
		InitialBalance: balance,
	}
}
