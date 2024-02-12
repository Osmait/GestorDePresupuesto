package transaction

import "time"

type Transaction struct {
	Id             string    `json:"id"`
	Name           string    `json:"name" validate:"required"`
	Description    string    `json:"description"`
	Amount         float64   `json:"amount" validate:"required"`
	TypeTransation string    `json:"type_transation" validator:"required"`
	AccountId      string    `json:"account_id"`
	CategoryId     string    `json:"category_id"`
	BudgetId       string    `json:"budget_id"`
	UserId         string    `json:"user_id"`
	CreatedAt      time.Time `json:"created_at"`
}

func NewTransaction(Id, Name, Description, TypeTransation, AccountId, categoryId string, Amount float64) *Transaction {
	return &Transaction{
		Id:             Id,
		Name:           Name,
		Description:    Description,
		Amount:         Amount,
		TypeTransation: TypeTransation,
		AccountId:      AccountId,
		CategoryId:     categoryId,
	}
}
