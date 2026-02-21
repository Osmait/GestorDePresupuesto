package dto

import (
	"errors"
	"strings"
	"time"

	"github.com/osmait/gestorDePresupuesto/internal/domain/loan"
)

type CreateLoanRequest struct {
	BorrowerName    string  `json:"borrower_name" binding:"required,min=2,max=120"`
	BorrowerContact string  `json:"borrower_contact"`
	PrincipalAmount float64 `json:"principal_amount" binding:"required,gt=0"`
	Currency        string  `json:"currency" binding:"omitempty,len=3"`
	InterestMode    string  `json:"interest_mode" binding:"required,oneof=fixed_total none"`
	AnnualRate      float64 `json:"annual_rate" binding:"gte=0,lte=100"`
	TermMonths      int     `json:"term_months" binding:"required,min=1,max=120"`
	StartDate       string  `json:"start_date"`
	SourceAccountId string  `json:"source_account_id" binding:"required"`
	Notes           string  `json:"notes"`
}

func (r *CreateLoanRequest) Validate() error {
	if r.PrincipalAmount <= 0 {
		return errors.New("principal_amount must be greater than 0")
	}
	if r.TermMonths < 1 || r.TermMonths > 120 {
		return errors.New("term_months must be between 1 and 120")
	}
	if r.InterestMode != string(loan.InterestModeFixedTotal) && r.InterestMode != string(loan.InterestModeNone) {
		return errors.New("interest_mode must be 'fixed_total' or 'none'")
	}
	if r.InterestMode == string(loan.InterestModeNone) {
		r.AnnualRate = 0
	}
	if r.Currency == "" {
		r.Currency = "DOP"
	}
	r.Currency = strings.ToUpper(r.Currency)
	if len(r.Currency) != 3 {
		return errors.New("currency must be 3 letters")
	}
	return nil
}

func (r *CreateLoanRequest) ParsedStartDate() time.Time {
	if r.StartDate == "" {
		return time.Now()
	}
	parsed, err := time.Parse("2006-01-02", r.StartDate)
	if err != nil {
		return time.Now()
	}
	return parsed
}

type UpdateLoanStatusRequest struct {
	Status loan.LoanStatus `json:"status" binding:"required,oneof=active paid defaulted cancelled"`
}

type RegisterLoanPaymentRequest struct {
	DestinationAccountId string  `json:"destination_account_id" binding:"required"`
	Amount               float64 `json:"amount" binding:"required,gt=0"`
	PaymentDate          string  `json:"payment_date"`
	Notes                string  `json:"notes"`
}

func (r *RegisterLoanPaymentRequest) Validate() error {
	if r.Amount <= 0 {
		return errors.New("amount must be greater than 0")
	}
	if r.DestinationAccountId == "" {
		return errors.New("destination_account_id is required")
	}
	return nil
}

func (r *RegisterLoanPaymentRequest) ParsedPaymentDate() time.Time {
	if r.PaymentDate == "" {
		return time.Now()
	}
	parsed, err := time.Parse("2006-01-02", r.PaymentDate)
	if err != nil {
		return time.Now()
	}
	return parsed
}
