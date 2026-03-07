package loan

import "time"

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
	PrincipalAmount         float64
	Currency                string
	InterestMode            InterestMode
	AnnualRate              float64
	TermMonths              int
	StartDate               time.Time
	SourceAccountId         string
	Notes                   string
	TotalInterest           float64
	TotalAmount             float64
	PaidPrincipal           float64
	PaidInterest            float64
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
	ExpectedAmount    float64
	PaidAmount        float64
	Status            InstallmentStatus
	PaidAt            *time.Time
	CreatedAt         time.Time
	UpdatedAt         time.Time
}

type Payment struct {
	Id                   string
	LoanId               string
	DestinationAccountId string
	Amount               float64
	PrincipalComponent   float64
	InterestComponent    float64
	PaymentDate          time.Time
	IncomeTransactionId  *string
	Notes                string
	CreatedAt            time.Time
}
