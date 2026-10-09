package dto

import (
	"time"

	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
)

type TransactionResponse struct {
	Id             string       `json:"id"`
	Name           string       `json:"name" validate:"required"`
	Description    string       `json:"description"`
	Amount         money.Amount `json:"amount" validate:"required"`
	TypeTransation string       `json:"type_transation" validator:"required"`
	AccountId      string       `json:"account_id"`
	CategoryId     string       `json:"category_id"`
	BudgetId       string       `json:"budget_id"`
	Currency       string       `json:"currency"`
	CreatedAt      time.Time    `json:"created_at"`
}

func NewTransactionResponse(Id, Name, Description, TypeTransation, AccountId, categoryId string, Amount money.Amount, currency string, createdAt time.Time) *TransactionResponse {
	return &TransactionResponse{
		Id:             Id,
		Name:           Name,
		Description:    Description,
		Amount:         Amount,
		TypeTransation: TypeTransation,
		AccountId:      AccountId,
		CategoryId:     categoryId,
		Currency:       currency,
		CreatedAt:      createdAt,
	}
}
