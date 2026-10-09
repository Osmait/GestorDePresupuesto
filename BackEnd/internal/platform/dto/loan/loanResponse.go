package dto

import (
	"time"

	"github.com/osmait/gestorDePresupuesto/internal/domain/loan"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
)

type LoanResponse struct {
	Id              string            `json:"id"`
	BorrowerName    string            `json:"borrower_name"`
	BorrowerContact string            `json:"borrower_contact"`
	PrincipalAmount money.Amount      `json:"principal_amount"`
	Currency        string            `json:"currency"`
	InterestMode    loan.InterestMode `json:"interest_mode"`
	AnnualRate      money.Amount      `json:"annual_rate"`
	TermMonths      int               `json:"term_months"`
	StartDate       time.Time         `json:"start_date"`
	SourceAccountId string            `json:"source_account_id"`
	Notes           string            `json:"notes"`
	TotalInterest   money.Amount      `json:"total_interest"`
	TotalAmount     money.Amount      `json:"total_amount"`
	PaidPrincipal   money.Amount      `json:"paid_principal"`
	PaidInterest    money.Amount      `json:"paid_interest"`
	PendingAmount   money.Amount      `json:"pending_amount"`
	Status          loan.LoanStatus   `json:"status"`
	CreatedAt       time.Time         `json:"created_at"`
	UpdatedAt       time.Time         `json:"updated_at"`
}

type LoanInstallmentResponse struct {
	Id                string                 `json:"id"`
	InstallmentNumber int                    `json:"installment_number"`
	DueDate           time.Time              `json:"due_date"`
	ExpectedAmount    money.Amount           `json:"expected_amount"`
	PaidAmount        money.Amount           `json:"paid_amount"`
	Status            loan.InstallmentStatus `json:"status"`
	PaidAt            *time.Time             `json:"paid_at"`
}

type LoanPaymentResponse struct {
	Id                   string       `json:"id"`
	DestinationAccountId string       `json:"destination_account_id"`
	Amount               money.Amount `json:"amount"`
	PrincipalComponent   money.Amount `json:"principal_component"`
	InterestComponent    money.Amount `json:"interest_component"`
	PaymentDate          time.Time    `json:"payment_date"`
	Notes                string       `json:"notes"`
	CreatedAt            time.Time    `json:"created_at"`
}

type LoanDetailsResponse struct {
	Loan         LoanResponse              `json:"loan"`
	Installments []LoanInstallmentResponse `json:"installments"`
	Payments     []LoanPaymentResponse     `json:"payments"`
}

type LoanSummaryResponse struct {
	TotalPrincipal      money.Amount `json:"total_principal"`
	TotalPending        money.Amount `json:"total_pending"`
	TotalCollected      money.Amount `json:"total_collected"`
	TotalInterestEarned money.Amount `json:"total_interest_earned"`
	OverdueLoans        int          `json:"overdue_loans"`
	ActiveLoans         int          `json:"active_loans"`
}

func NewLoanResponse(entity *loan.Loan) LoanResponse {
	pending := money.Max(entity.TotalAmount.Sub(entity.PaidPrincipal.Add(entity.PaidInterest)), money.Zero)

	return LoanResponse{
		Id:              entity.Id,
		BorrowerName:    entity.BorrowerName,
		BorrowerContact: entity.BorrowerContact,
		PrincipalAmount: entity.PrincipalAmount,
		Currency:        entity.Currency,
		InterestMode:    entity.InterestMode,
		AnnualRate:      entity.AnnualRate,
		TermMonths:      entity.TermMonths,
		StartDate:       entity.StartDate,
		SourceAccountId: entity.SourceAccountId,
		Notes:           entity.Notes,
		TotalInterest:   entity.TotalInterest,
		TotalAmount:     entity.TotalAmount,
		PaidPrincipal:   entity.PaidPrincipal,
		PaidInterest:    entity.PaidInterest,
		PendingAmount:   pending,
		Status:          entity.Status,
		CreatedAt:       entity.CreatedAt,
		UpdatedAt:       entity.UpdatedAt,
	}
}

func NewInstallmentResponse(entity *loan.Installment) LoanInstallmentResponse {
	return LoanInstallmentResponse{
		Id:                entity.Id,
		InstallmentNumber: entity.InstallmentNumber,
		DueDate:           entity.DueDate,
		ExpectedAmount:    entity.ExpectedAmount,
		PaidAmount:        entity.PaidAmount,
		Status:            entity.Status,
		PaidAt:            entity.PaidAt,
	}
}

func NewPaymentResponse(entity *loan.Payment) LoanPaymentResponse {
	return LoanPaymentResponse{
		Id:                   entity.Id,
		DestinationAccountId: entity.DestinationAccountId,
		Amount:               entity.Amount,
		PrincipalComponent:   entity.PrincipalComponent,
		InterestComponent:    entity.InterestComponent,
		PaymentDate:          entity.PaymentDate,
		Notes:                entity.Notes,
		CreatedAt:            entity.CreatedAt,
	}
}
