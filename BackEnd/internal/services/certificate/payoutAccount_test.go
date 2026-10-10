package certificate

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/osmait/gestorDePresupuesto/internal/domain/account"
	"github.com/osmait/gestorDePresupuesto/internal/domain/certificate"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
	dto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/certificate"
	"github.com/osmait/gestorDePresupuesto/internal/platform/i18n"
	"github.com/osmait/gestorDePresupuesto/internal/services/errorhttp"
)

type stubAccounts map[string]*account.Account

func (s stubAccounts) FindByIdAndUserId(_ context.Context, id string, userId string) (*account.Account, error) {
	if acc, ok := s[id]; ok && acc.UserId == userId {
		return acc, nil
	}
	return nil, errorhttp.ErrNotFound
}

func payoutAccounts() stubAccounts {
	bank := account.NewAccount(money.Zero, "bank-1", "Checking", "BHD")
	bank.UserId = "user-1"
	card := account.NewCreditCardAccount("card-1", "Visa", "BHD")
	card.UserId = "user-1"
	return stubAccounts{"bank-1": bank, "card-1": card}
}

func simpleCertificateRequest(payout string) *dto.CreateCertificateRequest {
	return &dto.CreateCertificateRequest{
		Bank:                "BHD",
		BaseCapital:         money.FromInt(100000),
		InterestType:        "simple",
		CurrentInterestRate: money.FromInt(5),
		CutDay:              15,
		PayoutAccountId:     &payout,
	}
}

func TestCreateCertificate_RejectsCreditCardPayoutAccount(t *testing.T) {
	repo := &MockCertificateRepository{}
	service := NewCertificateService(repo, nil, payoutAccounts())

	err := service.CreateCertificate(context.Background(), simpleCertificateRequest("card-1"), "user-1")

	assert.True(t, errors.Is(err, ErrCreditCardPayoutAccount))
	assert.True(t, errors.Is(err, errorhttp.ErrBadRequest), "must map to HTTP 400")
	assert.Contains(t, err.Error(), "credit card")
	repo.AssertNotCalled(t, "Save", mock.Anything, mock.Anything)
}

func TestCreateCertificate_RejectsUnknownPayoutAccount(t *testing.T) {
	repo := &MockCertificateRepository{}
	service := NewCertificateService(repo, nil, payoutAccounts())

	err := service.CreateCertificate(context.Background(), simpleCertificateRequest("someone-else"), "user-1")

	assert.True(t, errors.Is(err, ErrPayoutAccountNotFound))
	assert.True(t, errors.Is(err, errorhttp.ErrBadRequest))
	repo.AssertNotCalled(t, "Save", mock.Anything, mock.Anything)
}

func TestCreateCertificate_AcceptsBankPayoutAccount(t *testing.T) {
	repo := &MockCertificateRepository{}
	repo.On("Save", mock.Anything, mock.Anything).Return(nil)
	service := NewCertificateService(repo, nil, payoutAccounts())

	require.NoError(t, service.CreateCertificate(context.Background(), simpleCertificateRequest("bank-1"), "user-1"))
	repo.AssertExpectations(t)
}

func TestUpdateCertificate_RejectsCreditCardPayoutAccount(t *testing.T) {
	repo := &MockCertificateRepository{}
	repo.On("FindById", mock.Anything, "cert-1", "user-1").Return(&certificate.Certificate{Id: "cert-1", UserId: "user-1"}, nil)
	service := NewCertificateService(repo, nil, payoutAccounts())

	card := "card-1"
	err := service.UpdateCertificate(context.Background(), "cert-1", &dto.UpdateCertificateRequest{PayoutAccountId: &card}, "user-1")

	assert.True(t, errors.Is(err, ErrCreditCardPayoutAccount))
	repo.AssertNotCalled(t, "Update", mock.Anything, mock.Anything)
}

type recordedTx struct{ name, description string }

type recordingTransactions struct{ calls []recordedTx }

func (r *recordingTransactions) CreateTransaction(_ context.Context, name, description string, _ money.Amount, _ string, _ string, _ string, _ string, _ string, _ string, _ time.Time) error {
	r.calls = append(r.calls, recordedTx{name, description})
	return nil
}

func TestProcessPendingPayments_LocalizesInterestTransaction(t *testing.T) {
	cases := []struct {
		name     string
		ctx      context.Context
		wantName string
		wantDesc string
	}{
		{"default is spanish", context.Background(), "BHD - Pago de intereses", "Pago de intereses del certificado del "},
		{"english", i18n.WithLocale(context.Background(), i18n.EN), "BHD - Interest payment", "Certificate interest payment for period "},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			payout := "bank-1"
			now := time.Now()
			cert := &certificate.Certificate{
				Id: "cert-1", UserId: "user-1", Bank: "BHD", Status: certificate.StatusActive,
				InterestType: certificate.InterestTypeSimple, BaseCapital: money.FromInt(100000),
				CurrentInterestRate: money.FromInt(12), CutDay: now.Day(), PayoutAccountId: &payout,
				// Exactly one cut date between creation and now.
				CreatedAt: now.AddDate(0, -1, -1),
			}
			repo := &MockCertificateRepository{}
			repo.On("FindActiveByUser", mock.Anything, "user-1").Return([]*certificate.Certificate{cert}, nil)
			repo.On("FindLastPayment", mock.Anything, "cert-1", "user-1").Return(nil, sql.ErrNoRows)
			repo.On("SavePayment", mock.Anything, mock.Anything).Return(nil)
			txs := &recordingTransactions{}
			service := NewCertificateService(repo, txs, nil)

			require.NoError(t, service.ProcessPendingPayments(tc.ctx, "user-1"))
			require.NotEmpty(t, txs.calls)
			assert.Equal(t, tc.wantName, txs.calls[0].name)
			assert.True(t, strings.HasPrefix(txs.calls[0].description, tc.wantDesc), txs.calls[0].description)
		})
	}
}
