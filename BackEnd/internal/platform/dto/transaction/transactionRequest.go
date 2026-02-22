package dto

import (
	"errors"
	"time"
)

type TransactionRequest struct {
	Name           string    `json:"name" validate:"required" binding:"required" example:"Grocery Shopping"`
	Description    string    `json:"description" example:"Weekly grocery shopping at Walmart"`
	Amount         float64   `json:"amount" validate:"required" binding:"required,gt=0" example:"125.50"`
	TypeTransation string    `json:"type_transation" validate:"required" binding:"required" example:"bill" enums:"income,bill,loan_disbursement,loan_collection,investment_purchase,investment_funding"`
	AccountId      string    `json:"account_id" validate:"required" binding:"required" example:"acc_123456789"`
	CategoryId     string    `json:"category_id" validate:"required" binding:"required" example:"cat_987654321"`
	BudgetId       string    `json:"budget_id" example:"budget_555666777"`
	Currency       string    `json:"currency" example:"DOP"`
	CreatedAt      time.Time `json:"created_at" example:"2023-01-01T15:04:05Z"`
}

func NewTransactionRequest(Name, Description, TypeTransation, AccountId, categoryId, budgetId string, Amount float64) *TransactionRequest {
	return &TransactionRequest{
		Name:           Name,
		Description:    Description,
		Amount:         Amount,
		TypeTransation: TypeTransation,
		AccountId:      AccountId,
		CategoryId:     categoryId,
		BudgetId:       budgetId,
	}
}

func (t *TransactionRequest) Validate() error {
	if t.Amount <= 0 {
		return errors.New("amount must be greater than 0")
	}
	if t.TypeTransation != "income" && t.TypeTransation != "bill" && t.TypeTransation != "loan_disbursement" && t.TypeTransation != "loan_collection" && t.TypeTransation != "investment_purchase" && t.TypeTransation != "investment_funding" {
		return errors.New("type_transation must be 'income', 'bill', 'loan_disbursement', 'loan_collection', 'investment_purchase' or 'investment_funding'")
	}
	return nil
}
