package dto

import "time"

type BudgetResponse struct {
	CreatedAt     time.Time `json:"created_at"`
	Id            string    `json:"id"`
	CategoryId    string    `json:"category_id"`
	UserId        string    `json:"user_id"`
	Amount        float64   `json:"amount"`
	CurrentAmount float64   `json:"current_amount"`
}

func NewBudgetReponse(id, categoryId, userId string, amount, curentAmount float64, createdAt time.Time) *BudgetResponse {
	return &BudgetResponse{
		Id:            id,
		CategoryId:    categoryId,
		UserId:        userId,
		Amount:        amount,
		CurrentAmount: curentAmount,
		CreatedAt:     createdAt,
	}
}
