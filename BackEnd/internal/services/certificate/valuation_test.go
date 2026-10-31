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
	"github.com/osmait/gestorDePresupuesto/internal/domain/money/moneytest"
)

type creditedTx struct {
	description string
	amount      money.Amount
	accountID   string
	currency    string
}

type creditRecorder struct {
	calls []creditedTx
	err   error
}

func (r *creditRecorder) CreateTransaction(_ context.Context, _ string, description string, amount money.Amount, _ string, accountID string, _ string, _ string, _ string, currency string, _ time.Time) error {
	if r.err != nil {
		return r.err
	}
	r.calls = append(r.calls, creditedTx{description, amount, accountID, currency})
	return nil
}

func fixedRate(rate string) func(context.Context) (money.Amount, error) {
	return func(context.Context) (money.Amount, error) { return money.MustParse(rate), nil }
}

func rateDown(context.Context) (money.Amount, error) {
	return money.Zero, errors.New("rate service down")
}

// dueCertificate has exactly one payment due: 100,000 at 12% a year with no
// tax pays 1,000 a month.
func dueCertificate(currency string, interest certificate.InterestType, reinvest bool, payoutAccount string) *certificate.Certificate {
	// The most recent 15th (cut day) up to today; created 20 days before it,
	// after the cut before that one.
	now := time.Now().UTC()
	lastCut := time.Date(now.Year(), now.Month(), 15, 12, 0, 0, 0, time.UTC)
	if lastCut.After(now) {
		lastCut = lastCut.AddDate(0, -1, 0)
	}
	c := &certificate.Certificate{
		Id: "cert-1", UserId: "user-1", Bank: "BHD", Status: certificate.StatusActive, Currency: currency,
		InterestType: interest, ReinvestInterest: reinvest, BaseCapital: money.FromInt(100000),
		CurrentInterestRate: money.FromInt(12), CutDay: 15, CreatedAt: lastCut.AddDate(0, 0, -20),
	}
	if payoutAccount != "" {
		c.PayoutAccountId = &payoutAccount
	}
	return c
}

func payoutBankAccounts() stubAccounts {
	dop := account.NewAccount(money.Zero, "bank-dop", "Checking", "BHD")
	dop.UserId = "user-1"
	usd := account.NewAccount(money.Zero, "bank-usd", "Dollars", "BHD")
	usd.UserId = "user-1"
	usd.Currency = "USD"
	return stubAccounts{"bank-dop": dop, "bank-usd": usd}
}

// Interest is credited only when it is paid out, in the payout account's
// currency (converted at the live rate, rounded to cents); a payout that
// cannot be made leaves the payment pending and is reported, never swallowed.
func TestProcessPendingPayments_Payout(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name          string
		cert          *certificate.Certificate
		rate          func(context.Context) (money.Amount, error)
		wantCredit    *creditedTx
		wantSaved     bool
		wantPayoutErr string
	}{
		{
			name:       "dop certificate into dop account",
			cert:       dueCertificate("DOP", certificate.InterestTypeSimple, false, "bank-dop"),
			wantCredit: &creditedTx{amount: money.FromInt(1000), accountID: "bank-dop", currency: "DOP"},
			wantSaved:  true,
		},
		{
			name:       "usd certificate into dop account is converted",
			cert:       dueCertificate("USD", certificate.InterestTypeSimple, false, "bank-dop"),
			rate:       fixedRate("58.755"),
			wantCredit: &creditedTx{amount: money.MustParse("58755"), accountID: "bank-dop", currency: "DOP"},
			wantSaved:  true,
		},
		{
			name:       "dop certificate into usd account is converted",
			cert:       dueCertificate("DOP", certificate.InterestTypeSimple, false, "bank-usd"),
			rate:       fixedRate("60"),
			wantCredit: &creditedTx{amount: money.MustParse("16.67"), accountID: "bank-usd", currency: "USD"},
			wantSaved:  true,
		},
		{
			name:          "conversion without a rate leaves the payment pending",
			cert:          dueCertificate("USD", certificate.InterestTypeSimple, false, "bank-dop"),
			rate:          rateDown,
			wantPayoutErr: "exchange rate unavailable",
		},
		{
			name:          "deleted payout account leaves the payment pending",
			cert:          dueCertificate("DOP", certificate.InterestTypeSimple, false, "gone"),
			wantPayoutErr: "payout account not found",
		},
		{
			name:      "reinvested interest is never credited",
			cert:      dueCertificate("DOP", certificate.InterestTypeCompound, true, ""),
			wantSaved: true,
		},
		{
			name:       "compound without reinvestment pays out to its account",
			cert:       dueCertificate("DOP", certificate.InterestTypeCompound, false, "bank-dop"),
			wantCredit: &creditedTx{amount: money.FromInt(1000), accountID: "bank-dop", currency: "DOP"},
			wantSaved:  true,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			repo := &MockCertificateRepository{}
			repo.On("FindActiveByUser", mock.Anything, "user-1").Return([]*certificate.Certificate{tt.cert}, nil)
			repo.On("FindLastPayment", mock.Anything, "cert-1", "user-1").Return(nil, sql.ErrNoRows)
			if tt.wantSaved {
				repo.On("SavePayment", mock.Anything, mock.Anything).Return(nil).Once()
			}
			txs := &creditRecorder{}
			opts := []Option{}
			if tt.rate != nil {
				opts = append(opts, WithUsdToDopRate(tt.rate))
			}
			service := NewCertificateService(repo, txs, payoutBankAccounts(), opts...)

			payoutErrors, err := service.processPendingPayments(context.Background(), "user-1")
			require.NoError(t, err)

			if tt.wantPayoutErr != "" {
				assert.Contains(t, payoutErrors["cert-1"], tt.wantPayoutErr)
				repo.AssertNotCalled(t, "SavePayment", mock.Anything, mock.Anything)
			} else {
				assert.Empty(t, payoutErrors)
			}
			if tt.wantCredit == nil {
				assert.Empty(t, txs.calls)
			} else {
				require.Len(t, txs.calls, 1)
				got := txs.calls[0]
				moneytest.Equal(t, tt.wantCredit.amount, got.amount)
				assert.Equal(t, tt.wantCredit.accountID, got.accountID)
				assert.Equal(t, tt.wantCredit.currency, got.currency)
				if tt.cert.Currency != got.currency {
					assert.True(t, strings.Contains(got.description, "convertidos"), got.description)
				}
			}
			repo.AssertExpectations(t)
		})
	}
}

// A failure writing the income is returned, so the request rolls back the
// payment with it.
func TestProcessPendingPayments_CreditFailureIsReturned(t *testing.T) {
	t.Parallel()
	repo := &MockCertificateRepository{}
	repo.On("FindActiveByUser", mock.Anything, "user-1").Return([]*certificate.Certificate{dueCertificate("DOP", certificate.InterestTypeSimple, false, "bank-dop")}, nil)
	repo.On("FindLastPayment", mock.Anything, "cert-1", "user-1").Return(nil, sql.ErrNoRows)
	repo.On("SavePayment", mock.Anything, mock.Anything).Return(nil)
	service := NewCertificateService(repo, &creditRecorder{err: errors.New("db down")}, payoutBankAccounts())

	err := service.ProcessPendingPayments(context.Background(), "user-1")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "db down")
}

// FindAll reports a pending payout on the certificate.
func TestFindAll_SurfacesPayoutError(t *testing.T) {
	t.Parallel()
	cert := dueCertificate("USD", certificate.InterestTypeSimple, false, "bank-dop")
	repo := &MockCertificateRepository{}
	repo.On("FindActiveByUser", mock.Anything, "user-1").Return([]*certificate.Certificate{cert}, nil)
	repo.On("FindLastPayment", mock.Anything, "cert-1", "user-1").Return(nil, sql.ErrNoRows)
	repo.On("FindAll", mock.Anything, "user-1").Return([]*certificate.Certificate{cert}, nil)
	service := NewCertificateService(repo, &creditRecorder{}, payoutBankAccounts(), WithUsdToDopRate(rateDown))

	responses, err := service.FindAll(context.Background(), "user-1")
	require.NoError(t, err)
	require.Len(t, responses, 1)
	assert.Contains(t, responses[0].PayoutError, "exchange rate unavailable")
}

// The summary is in DOP; capital and portfolio value cover active
// certificates only, and the portfolio adds only capitalized interest.
func TestGetSummary_Valuation(t *testing.T) {
	t.Parallel()
	payout := "bank-dop"
	certs := []*certificate.Certificate{
		{Id: "simple", Status: certificate.StatusActive, Currency: "DOP", InterestType: certificate.InterestTypeSimple, BaseCapital: money.FromInt(100000), PayoutAccountId: &payout},
		{Id: "reinvest", Status: certificate.StatusActive, Currency: "DOP", InterestType: certificate.InterestTypeCompound, ReinvestInterest: true, BaseCapital: money.FromInt(100000)},
		{Id: "usd", Status: certificate.StatusActive, Currency: "USD", InterestType: certificate.InterestTypeSimple, BaseCapital: money.FromInt(1000), PayoutAccountId: &payout},
		{Id: "matured", Status: certificate.StatusMatured, Currency: "DOP", InterestType: certificate.InterestTypeCompound, ReinvestInterest: true, BaseCapital: money.FromInt(50000)},
	}
	day := func(d int) time.Time { return time.Date(2026, 10, d, 12, 0, 0, 0, time.UTC) }
	payments := []*certificate.CertificatePayment{
		{CertificateId: "simple", PaymentDate: day(15), AppliedCapital: money.FromInt(100000), NetInterest: money.FromInt(450), GrossInterest: money.FromInt(500), TaxWithheld: money.FromInt(50)},
		{CertificateId: "reinvest", PaymentDate: day(14), AppliedCapital: money.FromInt(100000), NetInterest: money.FromInt(450), GrossInterest: money.FromInt(500), TaxWithheld: money.FromInt(50)},
		{CertificateId: "reinvest", PaymentDate: day(15), AppliedCapital: money.FromInt(100450), NetInterest: money.FromInt(452), GrossInterest: money.FromInt(502), TaxWithheld: money.FromInt(50)},
		{CertificateId: "usd", PaymentDate: day(15), AppliedCapital: money.FromInt(1000), NetInterest: money.FromInt(5), GrossInterest: money.FromInt(5), TaxWithheld: money.Zero},
		{CertificateId: "matured", PaymentDate: day(1), AppliedCapital: money.FromInt(50000), NetInterest: money.FromInt(200), GrossInterest: money.FromInt(200), TaxWithheld: money.Zero},
	}
	repo := &MockCertificateRepository{}
	repo.On("FindAll", mock.Anything, "user-1").Return(certs, nil)
	repo.On("FindAllPayments", mock.Anything, "user-1").Return(payments, nil)
	service := NewCertificateService(repo, nil, nil, WithUsdToDopRate(fixedRate("60")))

	summary, err := service.GetSummary(context.Background(), "user-1")
	require.NoError(t, err)

	assert.Equal(t, 3, summary.ActiveCertificates)
	moneytest.Equal(t, 100000+100000+60000, summary.TotalCapital)
	// simple: capital only (interest paid out); reinvest: 100450 + 452; usd: 1000 * 60
	moneytest.Equal(t, 100000+100902+60000, summary.PortfolioValue)
	// every payment ever made, usd converted
	moneytest.Equal(t, 450+450+452+5*60+200, summary.TotalNetInterest)
}
