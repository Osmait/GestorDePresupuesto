package dto

import (
	"errors"
	"time"

	"github.com/osmait/gestorDePresupuesto/internal/domain/certificate"
)

type CreateCertificateRequest struct {
	Bank                string  `json:"bank" binding:"required,min=2,max=100"`
	BaseCapital         float64 `json:"base_capital" binding:"required,gt=0"`
	InterestType        string  `json:"interest_type" binding:"required,oneof=simple compound"`
	CurrentInterestRate float64 `json:"current_interest_rate" binding:"required,gt=0,lte=100"`
	CurrentTaxRate      float64 `json:"current_tax_rate" binding:"gte=0,lte=100"`
	CutDay              int     `json:"cut_day" binding:"required,min=1,max=28"`
	ReinvestInterest    bool    `json:"reinvest_interest"`
	PayoutAccountId     *string `json:"payout_account_id"`
	MaturityDate        string  `json:"maturity_date"`
	Currency            string  `json:"currency" binding:"omitempty,len=3"`
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
	return nil
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
	return &t
}

type UpdateCertificateRequest struct {
	Bank                *string                        `json:"bank" binding:"omitempty,min=2,max=100"`
	BaseCapital         *float64                       `json:"base_capital" binding:"omitempty,gt=0"`
	CurrentInterestRate *float64                       `json:"current_interest_rate" binding:"omitempty,gt=0,lte=100"`
	CurrentTaxRate      *float64                       `json:"current_tax_rate" binding:"omitempty,gte=0,lte=100"`
	CutDay              *int                           `json:"cut_day" binding:"omitempty,min=1,max=28"`
	ReinvestInterest    *bool                          `json:"reinvest_interest"`
	PayoutAccountId     *string                        `json:"payout_account_id"`
	Status              *certificate.CertificateStatus `json:"status" binding:"omitempty,oneof=active matured cancelled"`
}

type UpdateCertificatePaymentRequest struct {
	PaymentDate    *string  `json:"payment_date"`
	PeriodStart    *string  `json:"period_start"`
	PeriodEnd      *string  `json:"period_end"`
	GrossInterest  *float64 `json:"gross_interest" binding:"omitempty,gte=0"`
	TaxWithheld    *float64 `json:"tax_withheld" binding:"omitempty,gte=0"`
	NetInterest    *float64 `json:"net_interest" binding:"omitempty,gte=0"`
	AppliedRate    *float64 `json:"applied_rate" binding:"omitempty,gt=0,lte=100"`
	AppliedTaxRate *float64 `json:"applied_tax_rate" binding:"omitempty,gte=0,lte=100"`
	AppliedCapital *float64 `json:"applied_capital" binding:"omitempty,gt=0"`
}

type SimulatePaymentRequest struct {
	Capital *float64 `json:"capital" binding:"omitempty,gt=0"`
	Rate    *float64 `json:"rate" binding:"omitempty,gt=0,lte=100"`
	TaxRate *float64 `json:"tax_rate" binding:"omitempty,gte=0,lte=100"`
	Months  int      `json:"months" binding:"omitempty,min=1,max=60"`
}
