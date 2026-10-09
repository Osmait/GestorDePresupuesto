package dto

import "github.com/osmait/gestorDePresupuesto/internal/domain/money"

type BudgetRequest struct {
	CategoryId string       `json:"category_id"`
	Amount     money.Amount `json:"amount"`
}

func NewBudgetRequest(categoryId string, amount money.Amount) *BudgetRequest {
	return &BudgetRequest{
		CategoryId: categoryId,
		Amount:     amount,
	}
}
