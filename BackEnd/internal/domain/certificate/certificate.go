package certificate

import "time"

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
	BaseCapital         float64
	InterestType        InterestType
	CurrentInterestRate float64
	CurrentTaxRate      float64
	CutDay              int
	ReinvestInterest    bool
	PayoutAccountId     *string
	MaturityDate        *time.Time
	Status              CertificateStatus
	Currency            string
	CreatedAt           time.Time
	UpdatedAt           time.Time
}

func NewCertificate(id, userId, bank string, baseCapital float64, interestType InterestType, rate, taxRate float64, cutDay int) *Certificate {
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
