package dto

import (
	"time"

	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
)

type BudgetResponse struct {
	CreatedAt     time.Time    `json:"created_at"`
	Id            string       `json:"id"`
	CategoryId    string       `json:"category_id"`
	UserId        string       `json:"user_id"`
	Amount        money.Amount `json:"amount"`
	CurrentAmount money.Amount `json:"current_amount"`
}

func NewBudgetReponse(id, categoryId, userId string, amount, curentAmount money.Amount, createdAt time.Time) *BudgetResponse {
	return &BudgetResponse{
		Id:            id,
		CategoryId:    categoryId,
		UserId:        userId,
		Amount:        amount,
		CurrentAmount: curentAmount,
		CreatedAt:     createdAt,
	}
}
