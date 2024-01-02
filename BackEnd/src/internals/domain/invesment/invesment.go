package invesment

import "time"

type Invesment struct {
	CreatedAt    time.Time
	Id           string
	Name         string
	Price        float64
	CurrentPrice float64
	Quantity     int
}

func NewInvesment(id, name string, price, currentPrice float64, quantity int) *Invesment {
	return &Invesment{
		Id:           id,
		Name:         name,
		Price:        price,
		CurrentPrice: currentPrice,
		Quantity:     quantity,
	}
}
