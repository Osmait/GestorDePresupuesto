package transaction

import "time"

type Transaction struct {
	Id             string    `json:"id"`
	Name           string    `json:"name" validate:"required"`
	Description    string    `json:"description"`
	Amount         float64   `json:"amount" validate:"required"`
	TypeTransation string    `json:"type_transation" validator:"required"`
	Account_id     string    `json:"account_id"`
	Created_at     time.Time `json:"created_at"`
}

func NewTransaction(Id, Name, Description, TypeTransation, Account_id string, Amount float64) *Transaction {
	return &Transaction{
		Id:             Id,
		Name:           Name,
		Description:    Description,
		Amount:         Amount,
		TypeTransation: TypeTransation,
		Account_id:     Account_id,
	}
}
