package invesment

import "time"

type Invesment struct {
	CreatedAt    time.Time
	Id           string
	Name         string
	UserId       string
	Price        float64
	CurrentPrice float64
	Quantity     float64
}

func NewInvesment(id, name string, price, currentPrice float64, quantity float64, userId string) *Invesment {
	return &Invesment{
		Id:           id,
		Name:         name,
		Price:        price,
		CurrentPrice: currentPrice,
		Quantity:     quantity,
		UserId:       userId,
	}
}
