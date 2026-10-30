package dto

import (
	"errors"
	"time"

	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
	"github.com/osmait/gestorDePresupuesto/internal/domain/transaction"
)

type TransactionRequest struct {
	Name           string       `json:"name" validate:"required" binding:"required" example:"Grocery Shopping"`
	Description    string       `json:"description" example:"Weekly grocery shopping at Walmart"`
	Amount         money.Amount `json:"amount" validate:"required" binding:"required,gt=0" example:"125.50"`
	TypeTransation string       `json:"type_transation" validate:"required" binding:"required" example:"bill" enums:"income,bill,card_payment,loan_disbursement,loan_collection,investment_purchase,investment_funding"`
	AccountId      string       `json:"account_id" validate:"required" binding:"required" example:"acc_123456789"`
	CategoryId     string       `json:"category_id" validate:"required" binding:"required" example:"cat_987654321"`
	BudgetId       string       `json:"budget_id" example:"budget_555666777"`
	Currency       string       `json:"currency" example:"DOP"`
	CreatedAt      time.Time    `json:"created_at" example:"2023-01-01T15:04:05Z"`
}

func NewTransactionRequest(Name, Description, TypeTransation, AccountId, categoryId, budgetId string, Amount money.Amount) *TransactionRequest {
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
	if !t.Amount.IsPositive() {
		return errors.New("amount must be greater than 0")
	}
	// Card payments, loans and broker funding have their own endpoints, which
	// write the paired records and check the funds (see transaction.IsUserType).
	if !transaction.IsUserType(t.TypeTransation) {
		return errors.New("type_transation must be 'income' or 'bill'")
	}
	return nil
}
