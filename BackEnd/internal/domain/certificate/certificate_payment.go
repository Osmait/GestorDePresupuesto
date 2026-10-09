package certificate

import (
	"time"

	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
)

type CertificatePayment struct {
	Id              string
	CertificateId   string
	UserId          string
	PaymentDate     time.Time
	PeriodStart     time.Time
	PeriodEnd       time.Time
	GrossInterest   money.Amount
	TaxWithheld     money.Amount
	NetInterest     money.Amount
	AppliedRate     money.Amount
	AppliedTaxRate  money.Amount
	AppliedCapital  money.Amount
	PayoutAccountId *string
	TransactionId   *string
	CreatedAt       time.Time
	UpdatedAt       *time.Time
}

func NewCertificatePayment(id, certificateId, userId string, paymentDate, periodStart, periodEnd time.Time, gross, tax, net, rate, taxRate, capital money.Amount) *CertificatePayment {
	return &CertificatePayment{
		Id:             id,
		CertificateId:  certificateId,
		UserId:         userId,
		PaymentDate:    paymentDate,
		PeriodStart:    periodStart,
		PeriodEnd:      periodEnd,
		GrossInterest:  gross,
		TaxWithheld:    tax,
		NetInterest:    net,
		AppliedRate:    rate,
		AppliedTaxRate: taxRate,
		AppliedCapital: capital,
		CreatedAt:      time.Now(),
	}
}
