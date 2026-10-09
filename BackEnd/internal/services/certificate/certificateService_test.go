package certificate

import (
	"context"
	"database/sql"
	"errors"
	"testing"
	"time"

	"github.com/osmait/gestorDePresupuesto/internal/domain/certificate"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money/moneytest"
	dto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/certificate"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

var ErrRepositoryFailure = errors.New("repository failure")

type MockCertificateRepository struct {
	mock.Mock
}

func (m *MockCertificateRepository) Save(ctx context.Context, cert *certificate.Certificate) error {
	args := m.Called(ctx, cert)
	return args.Error(0)
}

func (m *MockCertificateRepository) FindAll(ctx context.Context, userId string) ([]*certificate.Certificate, error) {
	args := m.Called(ctx, userId)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*certificate.Certificate), args.Error(1)
}

func (m *MockCertificateRepository) FindById(ctx context.Context, id string, userId string) (*certificate.Certificate, error) {
	args := m.Called(ctx, id, userId)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*certificate.Certificate), args.Error(1)
}

func (m *MockCertificateRepository) Update(ctx context.Context, cert *certificate.Certificate) error {
	args := m.Called(ctx, cert)
	return args.Error(0)
}

func (m *MockCertificateRepository) Delete(ctx context.Context, id string, userId string) error {
	args := m.Called(ctx, id, userId)
	return args.Error(0)
}

func (m *MockCertificateRepository) FindActiveByUser(ctx context.Context, userId string) ([]*certificate.Certificate, error) {
	args := m.Called(ctx, userId)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*certificate.Certificate), args.Error(1)
}

func (m *MockCertificateRepository) UpdateStatus(ctx context.Context, id string, userId string, status certificate.CertificateStatus) error {
	args := m.Called(ctx, id, userId, status)
	return args.Error(0)
}

func (m *MockCertificateRepository) SavePayment(ctx context.Context, payment *certificate.CertificatePayment) error {
	args := m.Called(ctx, payment)
	return args.Error(0)
}

func (m *MockCertificateRepository) FindPaymentsByCertificate(ctx context.Context, certificateId string, userId string) ([]*certificate.CertificatePayment, error) {
	args := m.Called(ctx, certificateId, userId)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*certificate.CertificatePayment), args.Error(1)
}

func (m *MockCertificateRepository) FindLastPayment(ctx context.Context, certificateId string, userId string) (*certificate.CertificatePayment, error) {
	args := m.Called(ctx, certificateId, userId)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*certificate.CertificatePayment), args.Error(1)
}

func (m *MockCertificateRepository) FindAllPayments(ctx context.Context, userId string) ([]*certificate.CertificatePayment, error) {
	args := m.Called(ctx, userId)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*certificate.CertificatePayment), args.Error(1)
}

func (m *MockCertificateRepository) FindPaymentById(ctx context.Context, paymentId string, userId string) (*certificate.CertificatePayment, error) {
	args := m.Called(ctx, paymentId, userId)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*certificate.CertificatePayment), args.Error(1)
}

func (m *MockCertificateRepository) UpdatePayment(ctx context.Context, payment *certificate.CertificatePayment) error {
	args := m.Called(ctx, payment)
	return args.Error(0)
}

func (m *MockCertificateRepository) UpdatePaymentTransaction(ctx context.Context, paymentId string, userId string, transactionId string) error {
	args := m.Called(ctx, paymentId, userId, transactionId)
	return args.Error(0)
}

type MockTransactionService struct {
	mock.Mock
}

func (m *MockTransactionService) CreateTransaction(ctx context.Context, name, description string, amount money.Amount, typeTransaction string, accountId string, userId string, categoryId string, budgetId string, createdAt time.Time) error {
	args := m.Called(ctx, name, description, amount, typeTransaction, accountId, userId, categoryId, budgetId, createdAt)
	return args.Error(0)
}

func TestCalculateMonthlyPayment(t *testing.T) {
	calculator := &PaymentCalculator{}

	tests := []struct {
		name          string
		capital       money.Amount
		rate          money.Amount
		taxRate       money.Amount
		expectedGross money.Amount
		expectedTax   money.Amount
		expectedNet   money.Amount
	}{
		{
			name:          "Standard calculation",
			capital:       money.FromInt(250000),
			rate:          money.MustParse("4.55"),
			taxRate:       money.FromInt(10),
			expectedGross: money.MustParse("947.92"),
			expectedTax:   money.MustParse("94.79"),
			expectedNet:   money.MustParse("853.13"),
		},
		{
			name:          "Zero tax rate",
			capital:       money.FromInt(100000),
			rate:          money.FromInt(5),
			taxRate:       money.Zero,
			expectedGross: money.MustParse("416.67"),
			expectedTax:   money.Zero,
			expectedNet:   money.MustParse("416.67"),
		},
		{
			name:          "High interest rate",
			capital:       money.FromInt(100000),
			rate:          money.FromInt(12),
			taxRate:       money.FromInt(10),
			expectedGross: money.FromInt(1000),
			expectedTax:   money.FromInt(100),
			expectedNet:   money.FromInt(900),
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := calculator.CalculateMonthlyPayment(tt.capital, tt.rate, tt.taxRate)
			moneytest.Equal(t, tt.expectedGross, result.GrossInterest)
			moneytest.Equal(t, tt.expectedTax, result.TaxWithheld)
			moneytest.Equal(t, tt.expectedNet, result.NetInterest)
			moneytest.Equal(t, tt.capital, result.AppliedCapital)
		})
	}
}

func TestCreateCertificate(t *testing.T) {
	mockRepo := &MockCertificateRepository{}
	service := NewCertificateService(mockRepo, nil, nil)
	ctx := context.Background()

	payoutAccountId := "account-123"
	req := &dto.CreateCertificateRequest{
		Bank:                "Test Bank",
		BaseCapital:         money.FromInt(100000),
		InterestType:        "simple",
		CurrentInterestRate: money.FromInt(5),
		CurrentTaxRate:      money.FromInt(10),
		CutDay:              15,
		ReinvestInterest:    false,
		PayoutAccountId:     &payoutAccountId,
	}
	userId := "user-123"

	mockRepo.On("Save", ctx, mock.MatchedBy(func(cert *certificate.Certificate) bool {
		return cert.UserId == userId &&
			cert.Bank == req.Bank &&
			cert.BaseCapital == req.BaseCapital &&
			cert.InterestType == certificate.InterestTypeSimple
	})).Return(nil)

	err := service.CreateCertificate(ctx, req, userId)
	assert.NoError(t, err)
	mockRepo.AssertExpectations(t)
}

func TestCreateCertificate_CompoundWithReinvest(t *testing.T) {
	mockRepo := &MockCertificateRepository{}
	service := NewCertificateService(mockRepo, nil, nil)
	ctx := context.Background()

	payoutAccountId := "account-123"
	req := &dto.CreateCertificateRequest{
		Bank:                "Test Bank",
		BaseCapital:         money.FromInt(100000),
		InterestType:        "compound",
		CurrentInterestRate: money.FromInt(5),
		CurrentTaxRate:      money.FromInt(10),
		CutDay:              15,
		ReinvestInterest:    true,
		PayoutAccountId:     &payoutAccountId,
	}
	userId := "user-123"

	mockRepo.On("Save", ctx, mock.MatchedBy(func(cert *certificate.Certificate) bool {
		return cert.InterestType == certificate.InterestTypeCompound &&
			cert.ReinvestInterest == true &&
			cert.PayoutAccountId == nil
	})).Return(nil)

	err := service.CreateCertificate(ctx, req, userId)
	assert.NoError(t, err)
	mockRepo.AssertExpectations(t)
}

func TestCreateCertificate_ValidationError(t *testing.T) {
	mockRepo := &MockCertificateRepository{}
	service := NewCertificateService(mockRepo, nil, nil)
	ctx := context.Background()

	req := &dto.CreateCertificateRequest{
		Bank:                "Test Bank",
		BaseCapital:         money.FromInt(100000),
		InterestType:        "simple",
		CurrentInterestRate: money.FromInt(5),
		CurrentTaxRate:      money.FromInt(10),
		CutDay:              15,
		ReinvestInterest:    false,
	}
	userId := "user-123"

	err := service.CreateCertificate(ctx, req, userId)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "payout_account_id")
}

func TestDeleteCertificate(t *testing.T) {
	mockRepo := &MockCertificateRepository{}
	service := NewCertificateService(mockRepo, nil, nil)
	ctx := context.Background()

	certId := "cert-123"
	userId := "user-123"

	mockRepo.On("Delete", ctx, certId, userId).Return(nil)

	err := service.DeleteCertificate(ctx, certId, userId)
	assert.NoError(t, err)
	mockRepo.AssertExpectations(t)
}

func TestGetEffectiveCapital_Simple(t *testing.T) {
	mockRepo := &MockCertificateRepository{}
	service := NewCertificateService(mockRepo, nil, nil)

	cert := &certificate.Certificate{
		UserId:       "user-123",
		BaseCapital:  money.FromInt(100000),
		InterestType: certificate.InterestTypeSimple,
	}

	mockRepo.On("FindLastPayment", mock.Anything, mock.Anything, mock.Anything).Return(nil, sql.ErrNoRows)

	effectiveCapital, _ := service.GetEffectiveCapital(cert)
	moneytest.Equal(t, cert.BaseCapital, effectiveCapital)
}

func TestGetEffectiveCapital_CompoundWithoutReinvest(t *testing.T) {
	mockRepo := &MockCertificateRepository{}
	service := NewCertificateService(mockRepo, nil, nil)

	cert := &certificate.Certificate{
		UserId:           "user-123",
		BaseCapital:      money.FromInt(100000),
		InterestType:     certificate.InterestTypeCompound,
		ReinvestInterest: false,
	}

	mockRepo.On("FindLastPayment", mock.Anything, mock.Anything, mock.Anything).Return(nil, sql.ErrNoRows)

	effectiveCapital, _ := service.GetEffectiveCapital(cert)
	moneytest.Equal(t, cert.BaseCapital, effectiveCapital)
}

func TestSimulate(t *testing.T) {
	mockRepo := &MockCertificateRepository{}
	service := NewCertificateService(mockRepo, nil, nil)
	ctx := context.Background()

	cert := &certificate.Certificate{
		Id:                  "cert-123",
		UserId:              "user-123",
		BaseCapital:         money.FromInt(100000),
		InterestType:        certificate.InterestTypeSimple,
		CurrentInterestRate: money.FromInt(5),
		CurrentTaxRate:      money.FromInt(10),
	}

	mockRepo.On("FindById", ctx, cert.Id, cert.UserId).Return(cert, nil)

	req := &dto.SimulatePaymentRequest{
		Months: 12,
	}

	result, err := service.Simulate(ctx, cert.Id, req, cert.UserId)
	assert.NoError(t, err)
	assert.Len(t, result.Payments, 12)
	assert.True(t, result.Totals.NetInterest.IsPositive())
	mockRepo.AssertExpectations(t)
}

func TestSimulate_CompoundWithReinvest(t *testing.T) {
	mockRepo := &MockCertificateRepository{}
	service := NewCertificateService(mockRepo, nil, nil)
	ctx := context.Background()

	cert := &certificate.Certificate{
		Id:                  "cert-123",
		UserId:              "user-123",
		BaseCapital:         money.FromInt(100000),
		InterestType:        certificate.InterestTypeCompound,
		CurrentInterestRate: money.FromInt(5),
		CurrentTaxRate:      money.FromInt(10),
		ReinvestInterest:    true,
	}

	mockRepo.On("FindById", ctx, cert.Id, cert.UserId).Return(cert, nil)

	req := &dto.SimulatePaymentRequest{
		Months: 3,
	}

	result, err := service.Simulate(ctx, cert.Id, req, cert.UserId)
	assert.NoError(t, err)
	assert.Len(t, result.Payments, 3)

	// With compound interest, each month's interest should increase
	assert.True(t, result.Payments[0].NetInterest.LessThan(result.Payments[1].NetInterest))
	assert.True(t, result.Payments[1].NetInterest.LessThan(result.Payments[2].NetInterest))

	mockRepo.AssertExpectations(t)
}

// TestCalculateMonthlyPayment_Reconciles checks the decimal rounding policy:
// gross and tax are rounded half-even to cents and net is derived exactly, so
// gross == tax + net for every input.
func TestCalculateMonthlyPayment_Reconciles(t *testing.T) {
	t.Parallel()

	calculator := &PaymentCalculator{}
	for _, capital := range []string{"0.01", "333.33", "100000", "1234567.89", "999999999.99"} {
		for _, rate := range []string{"0.25", "5.5", "7.75", "12"} {
			for _, tax := range []string{"0", "10", "12.5"} {
				r := calculator.CalculateMonthlyPayment(money.MustParse(capital), money.MustParse(rate), money.MustParse(tax))
				assert.True(t, r.GrossInterest.Equal(r.TaxWithheld.Add(r.NetInterest)), "%s @ %s%% tax %s%%", capital, rate, tax)
				assert.True(t, r.GrossInterest.Equal(r.GrossInterest.RoundCents()))
				assert.True(t, r.TaxWithheld.Equal(r.TaxWithheld.RoundCents()))
			}
		}
	}

	// 100000 * 5.5% / 12 = 458.3333... -> 458.33; tax 10% = 45.833 -> 45.83
	r := calculator.CalculateMonthlyPayment(money.FromInt(100000), money.MustParse("5.5"), money.FromInt(10))
	moneytest.Equal(t, "458.33", r.GrossInterest)
	moneytest.Equal(t, "45.83", r.TaxWithheld)
	moneytest.Equal(t, "412.50", r.NetInterest)
}
