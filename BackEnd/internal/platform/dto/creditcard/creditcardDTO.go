package dto

import (
	"errors"
	"time"

	"github.com/osmait/gestorDePresupuesto/internal/domain/creditcard"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
)

type CreateCreditCardRequest struct {
	Name           string                 `json:"name" binding:"required,min=2,max=100"`
	Bank           string                 `json:"bank" binding:"required,min=2,max=100"`
	LastFourDigits string                 `json:"last_four_digits" binding:"omitempty,len=4"`
	CutDay         int                    `json:"cut_day" binding:"required,min=1,max=28"`
	DueDay         int                    `json:"due_day" binding:"required,min=1,max=28"`
	Balances       []CreateBalanceRequest `json:"balances" binding:"required,min=1,dive"`
}

type CreateBalanceRequest struct {
	Currency    string       `json:"currency" binding:"required,len=3"`
	CreditLimit money.Amount `json:"credit_limit" binding:"required,gt=0"`
	InitialDebt money.Amount `json:"initial_debt" binding:"gte=0"`
}

func (r *CreateCreditCardRequest) Validate() error {
	if r.CutDay < 1 || r.CutDay > 28 {
		return errors.New("cut_day must be between 1 and 28")
	}
	if r.DueDay < 1 || r.DueDay > 28 {
		return errors.New("due_day must be between 1 and 28")
	}
	if len(r.Balances) == 0 {
		return errors.New("at least one balance is required")
	}
	for _, b := range r.Balances {
		if !b.CreditLimit.IsPositive() {
			return errors.New("credit_limit must be greater than 0")
		}
		// card_balances.credit_limit / current_balance are DECIMAL(15,2).
		if err := money.CheckCents("credit_limit", b.CreditLimit); err != nil {
			return err
		}
		if err := money.CheckCents("initial_debt", b.InitialDebt); err != nil {
			return err
		}
	}
	return nil
}

type UpdateCreditCardRequest struct {
	Name           *string `json:"name" binding:"omitempty,min=2,max=100"`
	Bank           *string `json:"bank" binding:"omitempty,min=2,max=100"`
	LastFourDigits *string `json:"last_four_digits" binding:"omitempty,len=4"`
	CutDay         *int    `json:"cut_day" binding:"omitempty,min=1,max=28"`
	DueDay         *int    `json:"due_day" binding:"omitempty,min=1,max=28"`
}

type UpdateBalanceRequest struct {
	CreditLimit *money.Amount `json:"credit_limit" binding:"omitempty,gt=0"`
}

func (r *UpdateBalanceRequest) Validate() error {
	if r.CreditLimit != nil {
		return money.CheckCents("credit_limit", *r.CreditLimit)
	}
	return nil
}

type CreatePaymentRequest struct {
	FromAccountId    string       `json:"from_account_id" binding:"required"`
	Currency         string       `json:"currency" binding:"required,len=3"`
	Amount           money.Amount `json:"amount" binding:"required,gt=0"`
	ExchangeRate     money.Amount `json:"exchange_rate"`
	IncludesInterest bool         `json:"includes_interest"`
	InterestAmount   money.Amount `json:"interest_amount" binding:"gte=0"`
	Notes            string       `json:"notes"`
}

func (r *CreatePaymentRequest) Validate() error {
	if !r.Amount.IsPositive() {
		return errors.New("amount must be greater than 0")
	}
	if r.IncludesInterest && r.InterestAmount.IsNegative() {
		return errors.New("interest_amount cannot be negative")
	}
	// card_payments.amount / interest_amount are DECIMAL(15,2): reject what
	// PostgreSQL would silently round (e.g. 0.001).
	if err := money.CheckCents("amount", r.Amount); err != nil {
		return err
	}
	return money.CheckCents("interest_amount", r.InterestAmount)
}

type ResetBalanceRequest struct {
	BalanceId string `json:"balance_id"`
	Currency  string `json:"currency"`
	Notes     string `json:"notes"`
}

type BalanceResetResponse struct {
	Id              string       `json:"id"`
	BalanceId       string       `json:"balance_id"`
	CardId          string       `json:"card_id"`
	Currency        string       `json:"currency"`
	PreviousBalance money.Amount `json:"previous_balance"`
	Notes           string       `json:"notes"`
	CreatedAt       time.Time    `json:"created_at"`
}

func NewBalanceResetResponse(r *creditcard.CardBalanceReset) *BalanceResetResponse {
	return &BalanceResetResponse{
		Id:              r.Id,
		BalanceId:       r.BalanceId,
		CardId:          r.CardId,
		Currency:        r.Currency,
		PreviousBalance: r.PreviousBalance,
		Notes:           r.Notes,
		CreatedAt:       r.CreatedAt,
	}
}

type BalanceResponse struct {
	Id                 string       `json:"id"`
	Currency           string       `json:"currency"`
	CurrentBalance     money.Amount `json:"current_balance"`
	CreditLimit        money.Amount `json:"credit_limit"`
	AvailableCredit    money.Amount `json:"available_credit"`
	UtilizationPercent float64      `json:"utilization_percent"`
	CreatedAt          time.Time    `json:"created_at"`
	UpdatedAt          time.Time    `json:"updated_at"`
}

func NewBalanceResponse(b *creditcard.CardBalance) *BalanceResponse {
	return &BalanceResponse{
		Id:                 b.Id,
		Currency:           b.Currency,
		CurrentBalance:     b.CurrentBalance,
		CreditLimit:        b.CreditLimit,
		AvailableCredit:    b.AvailableCredit(),
		UtilizationPercent: b.UtilizationPercent(),
		CreatedAt:          b.CreatedAt,
		UpdatedAt:          b.UpdatedAt,
	}
}

type PaymentResponse struct {
	Id               string                   `json:"id"`
	CardId           string                   `json:"card_id"`
	FromAccountId    string                   `json:"from_account_id"`
	Currency         string                   `json:"currency"`
	Amount           money.Amount             `json:"amount"`
	SourceCurrency   string                   `json:"source_currency"`
	SourceAmount     money.Amount             `json:"source_amount"`
	ExchangeRate     money.Amount             `json:"exchange_rate"`
	IncludesInterest bool                     `json:"includes_interest"`
	InterestAmount   money.Amount             `json:"interest_amount"`
	PaymentDate      time.Time                `json:"payment_date"`
	Status           creditcard.PaymentStatus `json:"status"`
	Notes            string                   `json:"notes"`
	CreatedAt        time.Time                `json:"created_at"`
}

func NewPaymentResponse(p *creditcard.CardPayment) *PaymentResponse {
	return &PaymentResponse{
		Id:               p.Id,
		CardId:           p.CardId,
		FromAccountId:    p.FromAccountId,
		Currency:         p.Currency,
		Amount:           p.Amount,
		SourceCurrency:   p.SourceCurrency,
		SourceAmount:     p.SourceAmount,
		ExchangeRate:     p.ExchangeRate,
		IncludesInterest: p.IncludesInterest,
		InterestAmount:   p.InterestAmount,
		PaymentDate:      p.PaymentDate,
		Status:           p.Status,
		Notes:            p.Notes,
		CreatedAt:        p.CreatedAt,
	}
}

type CreditCardResponse struct {
	Id             string             `json:"id"`
	Name           string             `json:"name"`
	Bank           string             `json:"bank"`
	LastFourDigits string             `json:"last_four_digits"`
	CutDay         int                `json:"cut_day"`
	DueDay         int                `json:"due_day"`
	Balances       []*BalanceResponse `json:"balances"`
	NextCutDate    *time.Time         `json:"next_cut_date"`
	NextDueDate    *time.Time         `json:"next_due_date"`
	CreatedAt      time.Time          `json:"created_at"`
	UpdatedAt      time.Time          `json:"updated_at"`
}

type CreditCardSummaryResponse struct {
	TotalCards       int                     `json:"total_cards"`
	TotalDebt        map[string]money.Amount `json:"total_debt"`
	TotalCreditLimit map[string]money.Amount `json:"total_credit_limit"`
	AvgUtilization   map[string]float64      `json:"avg_utilization"`
	ByCard           []*CreditCardResponse   `json:"by_card"`
}
