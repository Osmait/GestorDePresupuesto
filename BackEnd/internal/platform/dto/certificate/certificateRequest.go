package dto

import (
	"errors"
	"time"

	"github.com/osmait/gestorDePresupuesto/internal/domain/certificate"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
	"github.com/osmait/gestorDePresupuesto/internal/platform/apptime"
)

type CreateCertificateRequest struct {
	Bank                string       `json:"bank" binding:"required,min=2,max=100"`
	BaseCapital         money.Amount `json:"base_capital" binding:"required,gt=0"`
	InterestType        string       `json:"interest_type" binding:"required,oneof=simple compound"`
	CurrentInterestRate money.Amount `json:"current_interest_rate" binding:"required,gt=0,lte=100"`
	CurrentTaxRate      money.Amount `json:"current_tax_rate" binding:"gte=0,lte=100"`
	CutDay              int          `json:"cut_day" binding:"required,min=1,max=28"`
	ReinvestInterest    bool         `json:"reinvest_interest"`
	PayoutAccountId     *string      `json:"payout_account_id"`
	MaturityDate        string       `json:"maturity_date"`
	Currency            string       `json:"currency" binding:"omitempty,len=3"`
}

func (r *CreateCertificateRequest) Validate() error {
	if r.InterestType != "simple" && r.InterestType != "compound" {
		return errors.New("interest_type must be 'simple' or 'compound'")
	}
	if r.InterestType == "simple" && r.PayoutAccountId == nil {
		return errors.New("payout_account_id is required for simple interest type")
	}
	if r.InterestType == "compound" && r.ReinvestInterest {
		r.PayoutAccountId = nil
	}
	// certificates.base_capital is DECIMAL(15,2).
	return money.CheckCents("base_capital", r.BaseCapital)
}

func (r *CreateCertificateRequest) GetInterestType() certificate.InterestType {
	if r.InterestType == "compound" {
		return certificate.InterestTypeCompound
	}
	return certificate.InterestTypeSimple
}

func (r *CreateCertificateRequest) GetMaturityDate() *time.Time {
	if r.MaturityDate == "" {
		return nil
	}
	t, err := time.Parse("2006-01-02", r.MaturityDate)
	if err != nil {
		return nil
	}
	// a calendar day at 12:00 UTC (the same day in the app time zone)
	t = apptime.NoonUTC(t.Date())
	return &t
}

type UpdateCertificateRequest struct {
	Bank                *string                        `json:"bank" binding:"omitempty,min=2,max=100"`
	BaseCapital         *money.Amount                  `json:"base_capital" binding:"omitempty,gt=0"`
	CurrentInterestRate *money.Amount                  `json:"current_interest_rate" binding:"omitempty,gt=0,lte=100"`
	CurrentTaxRate      *money.Amount                  `json:"current_tax_rate" binding:"omitempty,gte=0,lte=100"`
	CutDay              *int                           `json:"cut_day" binding:"omitempty,min=1,max=28"`
	ReinvestInterest    *bool                          `json:"reinvest_interest"`
	PayoutAccountId     *string                        `json:"payout_account_id"`
	Status              *certificate.CertificateStatus `json:"status" binding:"omitempty,oneof=active matured cancelled"`
}

// Validate rejects money with more decimals than its DECIMAL(15,2) column.
func (r *UpdateCertificateRequest) Validate() error {
	return checkOptionalCents(optionalAmount{"base_capital", r.BaseCapital})
}

type UpdateCertificatePaymentRequest struct {
	PaymentDate    *string       `json:"payment_date"`
	PeriodStart    *string       `json:"period_start"`
	PeriodEnd      *string       `json:"period_end"`
	GrossInterest  *money.Amount `json:"gross_interest" binding:"omitempty,gte=0"`
	TaxWithheld    *money.Amount `json:"tax_withheld" binding:"omitempty,gte=0"`
	NetInterest    *money.Amount `json:"net_interest" binding:"omitempty,gte=0"`
	AppliedRate    *money.Amount `json:"applied_rate" binding:"omitempty,gt=0,lte=100"`
	AppliedTaxRate *money.Amount `json:"applied_tax_rate" binding:"omitempty,gte=0,lte=100"`
	AppliedCapital *money.Amount `json:"applied_capital" binding:"omitempty,gt=0"`
}

// Validate rejects money with more decimals than its DECIMAL(15,2) column
// (certificate_payments.gross_interest, tax_withheld, net_interest,
// applied_capital).
func (r *UpdateCertificatePaymentRequest) Validate() error {
	return checkOptionalCents(
		optionalAmount{"gross_interest", r.GrossInterest},
		optionalAmount{"tax_withheld", r.TaxWithheld},
		optionalAmount{"net_interest", r.NetInterest},
		optionalAmount{"applied_capital", r.AppliedCapital},
	)
}

type optionalAmount struct {
	field string
	value *money.Amount
}

func checkOptionalCents(fields ...optionalAmount) error {
	for _, f := range fields {
		if f.value == nil {
			continue
		}
		if err := money.CheckCents(f.field, *f.value); err != nil {
			return err
		}
	}
	return nil
}

type SimulatePaymentRequest struct {
	Capital *money.Amount `json:"capital" binding:"omitempty,gt=0"`
	Rate    *money.Amount `json:"rate" binding:"omitempty,gt=0,lte=100"`
	TaxRate *money.Amount `json:"tax_rate" binding:"omitempty,gte=0,lte=100"`
	Months  int           `json:"months" binding:"omitempty,min=1,max=60"`
}
