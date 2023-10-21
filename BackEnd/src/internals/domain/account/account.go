package account

type Account struct {
	Id             string  `json:"id"`
	Name           string  `json:"name" validate:"required"`
	Bank           string  `json:"bank" validate:"required"`
	InitialBalance float64 `json:"initialBalance" validate:"required"`
	// User_id string  `json:"user_id"`
}

func NewAccount(balance float64, id string, name string, bank string) *Account {
	return &Account{
		Id:             id,
		Name:           name,
		Bank:           bank,
		InitialBalance: balance,
	}
}
