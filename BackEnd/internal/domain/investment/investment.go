package investment

import (
	"context"
	"time"
)

type InvestmentType string

const (
	Stock       InvestmentType = "stock"
	Crypto      InvestmentType = "crypto"
	FixedIncome InvestmentType = "fixed_income"
)

type Investment struct {
	ID            string         `json:"id"`
	UserID        string         `json:"user_id"`
	Type          InvestmentType `json:"type"`
	Name          string         `json:"name"`
	Symbol        string         `json:"symbol"`
	Quantity      float64        `json:"quantity"`
	PurchasePrice float64        `json:"purchase_price"`
	CurrentPrice  float64        `json:"current_price"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
}

func NewInvestment(id, userId string, investmentType InvestmentType, name, symbol string, quantity, purchasePrice, currentPrice float64) *Investment {
	return &Investment{
		ID:            id,
		UserID:        userId,
		Type:          investmentType,
		Name:          name,
		Symbol:        symbol,
		Quantity:      quantity,
		PurchasePrice: purchasePrice,
		CurrentPrice:  currentPrice,
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}
}

type InvestmentRepository interface {
	Save(ctx context.Context, investment *Investment) error
	FindAll(ctx context.Context, userId string) ([]*Investment, error)
	FindByID(ctx context.Context, id string) (*Investment, error)
	Update(ctx context.Context, investment *Investment) error
	Delete(ctx context.Context, id string) error
}
