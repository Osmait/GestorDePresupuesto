package budget

import "time"

type Budget struct {
	CreatedAt  time.Time
	Id         string
	categoryId string
	UserId     string
	Amount     float64
}

func NewBudget(id, categoryId, userId string, amount float64) *Budget {
	return &Budget{
		Id:         id,
		categoryId: categoryId,
		UserId:     userId,
		Amount:     amount,
	}
}
