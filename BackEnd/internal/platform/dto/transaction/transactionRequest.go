package dto

import "errors"

type TransactionRequest struct {
	Name           string  `json:"name" validate:"required" binding:"required" example:"Grocery Shopping"`
	Description    string  `json:"description" example:"Weekly grocery shopping at Walmart"`
	Amount         float64 `json:"amount" validate:"required" binding:"required,gt=0" example:"125.50"`
	TypeTransation string  `json:"type_transation" validate:"required" binding:"required" example:"expense" enums:"income,expense"`
	AccountId      string  `json:"account_id" validate:"required" binding:"required" example:"acc_123456789"`
	CategoryId     string  `json:"category_id" validate:"required" binding:"required" example:"cat_987654321"`
	BudgetId       string  `json:"budget_id" example:"budget_555666777"`
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
	if t.TypeTransation != "income" && t.TypeTransation != "expense" {
		return errors.New("type_transation must be 'income' or 'expense'")
	}
	return nil
}
