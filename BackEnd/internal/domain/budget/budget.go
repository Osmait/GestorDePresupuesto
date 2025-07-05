package budget

import "time"

type Budget struct {
	CreatedAt  time.Time
	Id         string
	CategoryId string
	UserId     string
	Amount     float64
}

func NewBudget(id, categoryId, userId string, amount float64) *Budget {
	return &Budget{
		Id:         id,
		CategoryId: categoryId,
		UserId:     userId,
		Amount:     amount,
	}
}
