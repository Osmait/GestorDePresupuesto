package dto

import (
	"time"

	"github.com/osmait/gestorDePresupuesto/internal/domain/loan"
)

type LoanResponse struct {
	Id              string            `json:"id"`
	BorrowerName    string            `json:"borrower_name"`
	BorrowerContact string            `json:"borrower_contact"`
	PrincipalAmount float64           `json:"principal_amount"`
	Currency        string            `json:"currency"`
	InterestMode    loan.InterestMode `json:"interest_mode"`
	AnnualRate      float64           `json:"annual_rate"`
	TermMonths      int               `json:"term_months"`
	StartDate       time.Time         `json:"start_date"`
	SourceAccountId string            `json:"source_account_id"`
	Notes           string            `json:"notes"`
	TotalInterest   float64           `json:"total_interest"`
	TotalAmount     float64           `json:"total_amount"`
	PaidPrincipal   float64           `json:"paid_principal"`
	PaidInterest    float64           `json:"paid_interest"`
	PendingAmount   float64           `json:"pending_amount"`
	Status          loan.LoanStatus   `json:"status"`
	CreatedAt       time.Time         `json:"created_at"`
	UpdatedAt       time.Time         `json:"updated_at"`
}

type LoanInstallmentResponse struct {
	Id                string                 `json:"id"`
	InstallmentNumber int                    `json:"installment_number"`
	DueDate           time.Time              `json:"due_date"`
	ExpectedAmount    float64                `json:"expected_amount"`
	PaidAmount        float64                `json:"paid_amount"`
	Status            loan.InstallmentStatus `json:"status"`
	PaidAt            *time.Time             `json:"paid_at"`
}

type LoanPaymentResponse struct {
	Id                   string    `json:"id"`
	DestinationAccountId string    `json:"destination_account_id"`
	Amount               float64   `json:"amount"`
	PrincipalComponent   float64   `json:"principal_component"`
	InterestComponent    float64   `json:"interest_component"`
	PaymentDate          time.Time `json:"payment_date"`
	Notes                string    `json:"notes"`
	CreatedAt            time.Time `json:"created_at"`
}

type LoanDetailsResponse struct {
	Loan         LoanResponse              `json:"loan"`
	Installments []LoanInstallmentResponse `json:"installments"`
	Payments     []LoanPaymentResponse     `json:"payments"`
}

type LoanSummaryResponse struct {
	TotalPrincipal      float64 `json:"total_principal"`
	TotalPending        float64 `json:"total_pending"`
	TotalCollected      float64 `json:"total_collected"`
	TotalInterestEarned float64 `json:"total_interest_earned"`
	OverdueLoans        int     `json:"overdue_loans"`
	ActiveLoans         int     `json:"active_loans"`
}

func NewLoanResponse(entity *loan.Loan) LoanResponse {
	pending := entity.TotalAmount - (entity.PaidPrincipal + entity.PaidInterest)
	if pending < 0 {
		pending = 0
	}

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
