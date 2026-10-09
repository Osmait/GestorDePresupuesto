package certificate

import (
	"time"

	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
)

type InterestType string

const (
	InterestTypeSimple   InterestType = "simple"
	InterestTypeCompound InterestType = "compound"
)

type CertificateStatus string

const (
	StatusActive    CertificateStatus = "active"
	StatusMatured   CertificateStatus = "matured"
	StatusCancelled CertificateStatus = "cancelled"
)

type Certificate struct {
	Id                  string
	UserId              string
	Bank                string
	BaseCapital         money.Amount
	InterestType        InterestType
	CurrentInterestRate money.Amount
	CurrentTaxRate      money.Amount
	CutDay              int
	ReinvestInterest    bool
	PayoutAccountId     *string
	MaturityDate        *time.Time
	Status              CertificateStatus
	Currency            string
	CreatedAt           time.Time
	UpdatedAt           time.Time
}

func NewCertificate(id, userId, bank string, baseCapital money.Amount, interestType InterestType, rate, taxRate money.Amount, cutDay int) *Certificate {
	return &Certificate{
		Id:                  id,
		UserId:              userId,
		Bank:                bank,
		BaseCapital:         baseCapital,
		InterestType:        interestType,
		CurrentInterestRate: rate,
		CurrentTaxRate:      taxRate,
		CutDay:              cutDay,
		Status:              StatusActive,
		Currency:            "DOP",
		CreatedAt:           time.Now(),
		UpdatedAt:           time.Now(),
	}
}
