package creditcard

import (
	"time"

	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
)

// PaymentReceivedType is the transaction a card payment writes on the card
// account (migration 000059): it lowers the debt. The paying account gets the
// usual card_payment. Neutral in reports, like card_payment.
const PaymentReceivedType = "card_payment_received"

type PaymentStatus string

const (
	PaymentStatusPending   PaymentStatus = "pending"
	PaymentStatusCompleted PaymentStatus = "completed"
	PaymentStatusCancelled PaymentStatus = "cancelled"
)

type CreditCard struct {
	AccountId      string
	Bank           string
	LastFourDigits string
	CutDay         int
	DueDay         int
	UserId         string
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

// CardBalance is one currency of a card: its credit limit, and as
// CurrentBalance the card's balance in that currency, which is the ledger
// balance of the card account (charges negative, payments and adjustments
// back). It is computed on read; card_balances.current_balance is always 0
// since migration 000060.
type CardBalance struct {
	Id             string
	CardId         string
	Currency       string
	CurrentBalance money.Amount
	CreditLimit    money.Amount
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

type CardBalanceReset struct {
	Id              string
	BalanceId       string
	CardId          string
	Currency        string
	PreviousBalance money.Amount
	Notes           string
	CreatedAt       time.Time
}

type CardPayment struct {
	Id               string
	CardId           string
	FromAccountId    string
	Currency         string
	Amount           money.Amount
	SourceCurrency   string
	SourceAmount     money.Amount
	ExchangeRate     money.Amount
	IncludesInterest bool
	InterestAmount   money.Amount
	PaymentDate      time.Time
	Status           PaymentStatus
	Notes            string
	CreatedAt        time.Time
}

func NewCreditCard(accountId, bank, lastFourDigits string, cutDay, dueDay int) *CreditCard {
	now := time.Now()
	return &CreditCard{
		AccountId:      accountId,
		Bank:           bank,
		LastFourDigits: lastFourDigits,
		CutDay:         cutDay,
		DueDay:         dueDay,
		CreatedAt:      now,
		UpdatedAt:      now,
	}
}

func NewCardBalance(id, cardId, currency string, creditLimit money.Amount) *CardBalance {
	now := time.Now()
	return &CardBalance{
		Id:             id,
		CardId:         cardId,
		Currency:       currency,
		CurrentBalance: money.Zero,
		CreditLimit:    creditLimit,
		CreatedAt:      now,
		UpdatedAt:      now,
	}
}

func NewCardPayment(id, cardId, fromAccountId, currency string, amount money.Amount) *CardPayment {
	return &CardPayment{
		Id:            id,
		CardId:        cardId,
		FromAccountId: fromAccountId,
		Currency:      currency,
		Amount:        amount,
		PaymentDate:   time.Now(),
		Status:        PaymentStatusCompleted,
		CreatedAt:     time.Now(),
	}
}

func (cb *CardBalance) AvailableCredit() money.Amount {
	return cb.CreditLimit.Add(cb.CurrentBalance)
}

// UtilizationPercent is the share of the credit limit in use. It is computed
// in decimal and returned as a float64 because it is a display-only ratio.
func (cb *CardBalance) UtilizationPercent() float64 {
	debt := money.Max(cb.CurrentBalance.Neg(), money.Zero)
	return money.Percent(debt, cb.CreditLimit)
}
