package postgress

import (
	"context"

	"github.com/osmait/gestorDePresupuesto/internal/domain/certificate"
)

type CertificateRepositoryInterface interface {
	Save(ctx context.Context, cert *certificate.Certificate) error
	FindAll(ctx context.Context, userId string) ([]*certificate.Certificate, error)
	FindById(ctx context.Context, id string, userId string) (*certificate.Certificate, error)
	Update(ctx context.Context, cert *certificate.Certificate) error
	Delete(ctx context.Context, id string, userId string) error
	FindActiveByUser(ctx context.Context, userId string) ([]*certificate.Certificate, error)
	UpdateStatus(ctx context.Context, id string, status certificate.CertificateStatus) error

	SavePayment(ctx context.Context, payment *certificate.CertificatePayment) error
	FindPaymentsByCertificate(ctx context.Context, certificateId string) ([]*certificate.CertificatePayment, error)
	FindLastPayment(ctx context.Context, certificateId string) (*certificate.CertificatePayment, error)
	FindAllPayments(ctx context.Context, userId string) ([]*certificate.CertificatePayment, error)
	UpdatePaymentTransaction(ctx context.Context, paymentId string, transactionId string) error
}
