package investment

import (
	"context"
	"time"

	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
)

type InvestmentType string

const (
	Stock       InvestmentType = "stock"
	Crypto      InvestmentType = "crypto"
	FixedIncome InvestmentType = "fixed_income"
)

type Investment struct {
	ID                 string         `json:"id"`
	UserID             string         `json:"user_id"`
	Type               InvestmentType `json:"type"`
	Name               string         `json:"name"`
	Symbol             string         `json:"symbol"`
	Quantity           money.Amount   `json:"quantity"`
	PurchasePrice      money.Amount   `json:"purchase_price"`
	CurrentPrice       money.Amount   `json:"current_price"`
	SourceAccountID    string         `json:"source_account_id"`
	SourceAmount       money.Amount   `json:"source_amount"`
	SettlementCurrency string         `json:"settlement_currency"`
	ExchangeRate       money.Amount   `json:"exchange_rate"`
	CreatedAt          time.Time      `json:"created_at"`
	UpdatedAt          time.Time      `json:"updated_at"`
}

type FundingBalance struct {
	Currency  string       `json:"currency"`
	Available money.Amount `json:"available"`
}

type FundingMovement struct {
	ID              string       `json:"id"`
	UserID          string       `json:"user_id"`
	Currency        string       `json:"currency"`
	Amount          money.Amount `json:"amount"`
	MovementType    string       `json:"movement_type"`
	Description     string       `json:"description"`
	ReferenceType   string       `json:"reference_type"`
	ReferenceID     string       `json:"reference_id"`
	CounterCurrency string       `json:"counter_currency"`
	CounterAmount   money.Amount `json:"counter_amount"`
	ExchangeRate    money.Amount `json:"exchange_rate"`
	CreatedAt       time.Time    `json:"created_at"`
}

func NewInvestment(id, userId string, investmentType InvestmentType, name, symbol string, quantity, purchasePrice, currentPrice money.Amount) *Investment {
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

// InvestmentRepository persists investments. Every method is scoped to the
// owning user: Update uses investment.UserID, and rows of other users are
// reported as not found.
type InvestmentRepository interface {
	Save(ctx context.Context, investment *Investment) error
	FindAll(ctx context.Context, userId string) ([]*Investment, error)
	FindByID(ctx context.Context, id string, userId string) (*Investment, error)
	// FindByIDForUpdate is FindByID plus a row lock held until the request
	// transaction ends.
	FindByIDForUpdate(ctx context.Context, id string, userId string) (*Investment, error)
	// UpdateCurrentPrice sets only current_price (quote refresh).
	UpdateCurrentPrice(ctx context.Context, id string, userId string, price money.Amount) error
	Update(ctx context.Context, investment *Investment) error
	Delete(ctx context.Context, id string, userId string) error
	GetFundingBalances(ctx context.Context, userId string) ([]*FundingBalance, error)
	AddFunding(ctx context.Context, movement *FundingMovement) error
	ConsumeFundingForInvestment(ctx context.Context, inv *Investment, currency string, requiredAmount money.Amount) error
	// AdjustFundingForInvestment moves delta (positive: debit, negative:
	// credit) between the user's wallet in currency and investment
	// investmentID, recording an "adjustment" movement. A debit larger than
	// the wallet balance fails with the repository's insufficient-funding
	// error and changes nothing.
	AdjustFundingForInvestment(ctx context.Context, userId, investmentID, currency string, delta money.Amount, description string) error
}
