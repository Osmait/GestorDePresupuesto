package dto

import "time"

type BudgetResponse struct {
	CreatedAt     time.Time
	Id            string
	CategoryId    string
	UserId        string
	Amount        float64
	CurrentAmount float64
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
