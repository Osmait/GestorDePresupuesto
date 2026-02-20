package creditcard

import "time"

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

type CardBalance struct {
	Id             string
	CardId         string
	Currency       string
	CurrentBalance float64
	CreditLimit    float64
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

type CardPayment struct {
	Id               string
	CardId           string
	FromAccountId    string
	Currency         string
	Amount           float64
	IncludesInterest bool
	InterestAmount   float64
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

func NewCardBalance(id, cardId, currency string, creditLimit float64) *CardBalance {
	now := time.Now()
	return &CardBalance{
		Id:             id,
		CardId:         cardId,
		Currency:       currency,
		CurrentBalance: 0,
		CreditLimit:    creditLimit,
		CreatedAt:      now,
		UpdatedAt:      now,
	}
}

func NewCardPayment(id, cardId, fromAccountId, currency string, amount float64) *CardPayment {
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

func (cb *CardBalance) AvailableCredit() float64 {
	return cb.CreditLimit + cb.CurrentBalance
}

func (cb *CardBalance) UtilizationPercent() float64 {
	if cb.CreditLimit == 0 {
		return 0
	}
	return (cb.CurrentBalance * -1 / cb.CreditLimit) * 100
}
