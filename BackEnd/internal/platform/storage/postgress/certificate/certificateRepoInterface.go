package postgress

import (
	"context"

	"github.com/osmait/gestorDePresupuesto/internal/domain/certificate"
)

// CertificateRepositoryInterface persists certificates and their payments.
// Every method is scoped to the owning user; rows of other users are reported
// as not found and payout accounts must belong to the certificate owner.
type CertificateRepositoryInterface interface {
	Save(ctx context.Context, cert *certificate.Certificate) error
	FindAll(ctx context.Context, userId string) ([]*certificate.Certificate, error)
	FindById(ctx context.Context, id string, userId string) (*certificate.Certificate, error)
	Update(ctx context.Context, cert *certificate.Certificate) error
	Delete(ctx context.Context, id string, userId string) error
	FindActiveByUser(ctx context.Context, userId string) ([]*certificate.Certificate, error)
	UpdateStatus(ctx context.Context, id string, userId string, status certificate.CertificateStatus) error

	SavePayment(ctx context.Context, payment *certificate.CertificatePayment) error
	FindPaymentsByCertificate(ctx context.Context, certificateId string, userId string) ([]*certificate.CertificatePayment, error)
	FindLastPayment(ctx context.Context, certificateId string, userId string) (*certificate.CertificatePayment, error)
	// FindLastPayments is FindLastPayment for several certificates in one
	// query, keyed by certificate id (certificates without payments are absent).
	FindLastPayments(ctx context.Context, certificateIds []string, userId string) (map[string]*certificate.CertificatePayment, error)
	FindAllPayments(ctx context.Context, userId string) ([]*certificate.CertificatePayment, error)
	FindPaymentById(ctx context.Context, paymentId string, userId string) (*certificate.CertificatePayment, error)
	UpdatePayment(ctx context.Context, payment *certificate.CertificatePayment) error
	UpdatePaymentTransaction(ctx context.Context, paymentId string, userId string, transactionId string) error
}
