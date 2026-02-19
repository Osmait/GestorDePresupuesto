package certificate

import "time"

type CertificatePayment struct {
	Id              string
	CertificateId   string
	UserId          string
	PaymentDate     time.Time
	PeriodStart     time.Time
	PeriodEnd       time.Time
	GrossInterest   float64
	TaxWithheld     float64
	NetInterest     float64
	AppliedRate     float64
	AppliedTaxRate  float64
	AppliedCapital  float64
	PayoutAccountId *string
	TransactionId   *string
	CreatedAt       time.Time
}

func NewCertificatePayment(id, certificateId, userId string, paymentDate, periodStart, periodEnd time.Time, gross, tax, net, rate, taxRate, capital float64) *CertificatePayment {
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
