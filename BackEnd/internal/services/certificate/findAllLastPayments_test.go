package certificate

import (
	"context"
	"database/sql"
	"testing"
	"time"

	"github.com/osmait/gestorDePresupuesto/internal/domain/certificate"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

// FindAll reads the last payment of the compound certificates only (simple
// and cancelled ones are not looked up) and values each compound certificate
// from it, as GetEffectiveCapital does one by one.
func TestFindAll_LastPaymentsOfCompoundCertificates(t *testing.T) {
	t.Parallel()
	created := time.Date(2026, time.January, 3, 12, 0, 0, 0, time.UTC)
	cert := func(id string, interest certificate.InterestType, status certificate.CertificateStatus) *certificate.Certificate {
		return &certificate.Certificate{
			Id: id, UserId: "user-1", Bank: "BHD", Status: status, Currency: "DOP", InterestType: interest,
			ReinvestInterest: true, BaseCapital: money.FromInt(100000), CurrentInterestRate: money.FromInt(12),
			CutDay: 15, CreatedAt: created,
		}
	}
	simple := cert("simple", certificate.InterestTypeSimple, certificate.StatusActive)
	compound := cert("compound", certificate.InterestTypeCompound, certificate.StatusActive)
	fresh := cert("fresh", certificate.InterestTypeCompound, certificate.StatusActive)
	cancelled := cert("cancelled", certificate.InterestTypeCompound, certificate.StatusCancelled)
	paidOn := time.Date(2026, time.February, 15, 12, 0, 0, 0, time.UTC)
	last := &certificate.CertificatePayment{
		Id: "p1", CertificateId: "compound", PaymentDate: paidOn,
		AppliedCapital: money.FromInt(100000), NetInterest: money.FromInt(1000),
	}

	repo := &MockCertificateRepository{}
	repo.On("FindActiveByUser", mock.Anything, "user-1").Return([]*certificate.Certificate{}, nil)
	repo.On("FindAll", mock.Anything, "user-1").Return([]*certificate.Certificate{simple, compound, cancelled, fresh}, nil)
	repo.On("FindLastPayment", mock.Anything, "compound", "user-1").Return(last, nil).Once()
	repo.On("FindLastPayment", mock.Anything, "fresh", "user-1").Return(nil, sql.ErrNoRows).Once()
	service := NewCertificateService(repo, nil, nil, WithLocation(time.UTC))

	responses, err := service.FindAll(context.Background(), "user-1")
	require.NoError(t, err)
	repo.AssertExpectations(t)

	require.Len(t, responses, 3)
	assert.Equal(t, []string{"simple", "compound", "fresh"}, []string{responses[0].Id, responses[1].Id, responses[2].Id})
	assert.Equal(t, "100000", responses[0].EffectiveCapital.String())
	assert.Equal(t, "101000", responses[1].EffectiveCapital.String())
	assert.Equal(t, "100000", responses[2].EffectiveCapital.String())

	// The next payment counts from the last payment, or from creation.
	require.NotNil(t, responses[1].NextPaymentDate)
	assert.Equal(t, time.March, responses[1].NextPaymentDate.Month())
	require.NotNil(t, responses[2].NextPaymentDate)
	assert.Equal(t, time.January, responses[2].NextPaymentDate.Month())
}
