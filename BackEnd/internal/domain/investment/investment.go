package investment

import "time"

type Investment struct {
	CreatedAt    time.Time
	Id           string
	Name         string
	UserId       string
	Price        float64
	CurrentPrice float64
	Quantity     float64
}

func NewInvestment(id, name string, price, currentPrice float64, quantity float64, userId string) *Investment {
	return &Investment{
		Id:           id,
		Name:         name,
		Price:        price,
		CurrentPrice: currentPrice,
		Quantity:     quantity,
		UserId:       userId,
	}
}
