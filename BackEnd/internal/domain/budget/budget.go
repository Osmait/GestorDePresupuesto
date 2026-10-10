package budget

import (
	"time"

	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
)

type Budget struct {
	CreatedAt    time.Time
	Id           string
	CategoryId   string
	UserId       string
	Amount       money.Amount
	CategoryName string `json:"category_name,omitempty"`
}

func NewBudget(id, categoryId, userId string, amount money.Amount) *Budget {
	return &Budget{
		Id:         id,
		CategoryId: categoryId,
		UserId:     userId,
		Amount:     amount,
	}
}
