package loan

import (
	"time"

	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
)

type InterestMode string

const (
	InterestModeFixedTotal InterestMode = "fixed_total"
	InterestModeNone       InterestMode = "none"
)

type LoanStatus string

const (
	LoanStatusActive    LoanStatus = "active"
	LoanStatusPaid      LoanStatus = "paid"
	LoanStatusDefaulted LoanStatus = "defaulted"
	LoanStatusCancelled LoanStatus = "cancelled"
)

type InstallmentStatus string

const (
	InstallmentStatusPending InstallmentStatus = "pending"
	InstallmentStatusPartial InstallmentStatus = "partial"
	InstallmentStatusPaid    InstallmentStatus = "paid"
	InstallmentStatusOverdue InstallmentStatus = "overdue"
)

type Loan struct {
	Id                      string
	UserId                  string
	BorrowerName            string
	BorrowerContact         string
	PrincipalAmount         money.Amount
	Currency                string
	InterestMode            InterestMode
	AnnualRate              money.Amount
	TermMonths              int
	StartDate               time.Time
	SourceAccountId         string
	Notes                   string
	TotalInterest           money.Amount
	TotalAmount             money.Amount
	PaidPrincipal           money.Amount
	PaidInterest            money.Amount
	Status                  LoanStatus
	DisbursementTransaction *string
	CreatedAt               time.Time
	UpdatedAt               time.Time
}

type Installment struct {
	Id                string
	LoanId            string
	InstallmentNumber int
	DueDate           time.Time
	ExpectedAmount    money.Amount
	PaidAmount        money.Amount
	Status            InstallmentStatus
	PaidAt            *time.Time
	CreatedAt         time.Time
	UpdatedAt         time.Time
}

type Payment struct {
	Id                   string
	LoanId               string
	DestinationAccountId string
	Amount               money.Amount
	PrincipalComponent   money.Amount
	InterestComponent    money.Amount
	PaymentDate          time.Time
	IncomeTransactionId  *string
	Notes                string
	CreatedAt            time.Time
}
