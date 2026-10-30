package dto

import (
	"errors"
	"strings"
	"time"

	"github.com/osmait/gestorDePresupuesto/internal/domain/loan"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
	"github.com/osmait/gestorDePresupuesto/internal/platform/apptime"
)

type CreateLoanRequest struct {
	BorrowerName    string       `json:"borrower_name" binding:"required,min=2,max=120"`
	BorrowerContact string       `json:"borrower_contact"`
	PrincipalAmount money.Amount `json:"principal_amount" binding:"required,gt=0"`
	Currency        string       `json:"currency" binding:"omitempty,len=3"`
	InterestMode    string       `json:"interest_mode" binding:"required,oneof=fixed_total none"`
	AnnualRate      money.Amount `json:"annual_rate" binding:"gte=0,lte=100"`
	TermMonths      int          `json:"term_months" binding:"required,min=1,max=120"`
	StartDate       string       `json:"start_date"`
	SourceAccountId string       `json:"source_account_id" binding:"required"`
	Notes           string       `json:"notes"`
}

func (r *CreateLoanRequest) Validate() error {
	if !r.PrincipalAmount.IsPositive() {
		return errors.New("principal_amount must be greater than 0")
	}
	// loans.principal_amount is DECIMAL(15,2).
	if err := money.CheckCents("principal_amount", r.PrincipalAmount); err != nil {
		return err
	}
	if r.TermMonths < 1 || r.TermMonths > 120 {
		return errors.New("term_months must be between 1 and 120")
	}
	if r.InterestMode != string(loan.InterestModeFixedTotal) && r.InterestMode != string(loan.InterestModeNone) {
		return errors.New("interest_mode must be 'fixed_total' or 'none'")
	}
	if r.InterestMode == string(loan.InterestModeNone) {
		r.AnnualRate = money.Zero
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

// ParsedStartDate returns the loan's start date as a calendar day at 12:00
// UTC (the same day in UTC and in the app time zone, see apptime): the given
// YYYY-MM-DD, or today in loc (at now) when it is empty or invalid.
// loans.start_date is a DATE and the disbursement transaction is dated with
// it, so 00:00 UTC (the previous evening in Santo Domingo) would put the
// disbursement on the previous local day.
func (r *CreateLoanRequest) ParsedStartDate(now time.Time, loc *time.Location) time.Time {
	if r.StartDate != "" {
		if y, m, d, err := apptime.ParseCalendarDate(r.StartDate); err == nil {
			return apptime.NoonUTC(y, m, d)
		}
	}
	return apptime.TodayNoonUTC(now, loc)
}

type UpdateLoanStatusRequest struct {
	Status loan.LoanStatus `json:"status" binding:"required,oneof=active paid defaulted cancelled"`
}

type RegisterLoanPaymentRequest struct {
	DestinationAccountId string       `json:"destination_account_id" binding:"required"`
	Amount               money.Amount `json:"amount" binding:"required,gt=0"`
	PaymentDate          string       `json:"payment_date"`
	Notes                string       `json:"notes"`
}

func (r *RegisterLoanPaymentRequest) Validate() error {
	if !r.Amount.IsPositive() {
		return errors.New("amount must be greater than 0")
	}
	// loan_payments.amount is DECIMAL(15,2).
	if err := money.CheckCents("amount", r.Amount); err != nil {
		return err
	}
	if r.DestinationAccountId == "" {
		return errors.New("destination_account_id is required")
	}
	return nil
}

// ParsedPaymentDate returns the payment date: the given YYYY-MM-DD as that
// calendar day at 12:00 UTC (the same day in UTC and in the app time zone; at
// 00:00 UTC the collection transaction would land on the previous local
// day), or now when it is empty or invalid.
func (r *RegisterLoanPaymentRequest) ParsedPaymentDate(now time.Time) time.Time {
	if r.PaymentDate != "" {
		if y, m, d, err := apptime.ParseCalendarDate(r.PaymentDate); err == nil {
			return apptime.NoonUTC(y, m, d)
		}
	}
	return now
}
