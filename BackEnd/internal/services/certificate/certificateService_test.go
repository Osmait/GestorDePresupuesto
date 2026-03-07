package certificate

import (
	"context"
	"database/sql"
	"errors"
	"testing"
	"time"

	"github.com/osmait/gestorDePresupuesto/internal/domain/certificate"
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

func (m *MockCertificateRepository) UpdateStatus(ctx context.Context, id string, status certificate.CertificateStatus) error {
	args := m.Called(ctx, id, status)
	return args.Error(0)
}

func (m *MockCertificateRepository) SavePayment(ctx context.Context, payment *certificate.CertificatePayment) error {
	args := m.Called(ctx, payment)
	return args.Error(0)
}

func (m *MockCertificateRepository) FindPaymentsByCertificate(ctx context.Context, certificateId string) ([]*certificate.CertificatePayment, error) {
	args := m.Called(ctx, certificateId)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).([]*certificate.CertificatePayment), args.Error(1)
}

func (m *MockCertificateRepository) FindLastPayment(ctx context.Context, certificateId string) (*certificate.CertificatePayment, error) {
	args := m.Called(ctx, certificateId)
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

func (m *MockCertificateRepository) UpdatePaymentTransaction(ctx context.Context, paymentId string, transactionId string) error {
	args := m.Called(ctx, paymentId, transactionId)
	return args.Error(0)
}

type MockTransactionService struct {
	mock.Mock
}

func (m *MockTransactionService) CreateTransaction(ctx context.Context, name, description string, amount float64, typeTransaction string, accountId string, userId string, categoryId string, budgetId string, createdAt time.Time) error {
	args := m.Called(ctx, name, description, amount, typeTransaction, accountId, userId, categoryId, budgetId, createdAt)
	return args.Error(0)
}

func TestCalculateMonthlyPayment(t *testing.T) {
	calculator := &PaymentCalculator{}

	tests := []struct {
		name          string
		capital       float64
		rate          float64
		taxRate       float64
		expectedGross float64
		expectedTax   float64
		expectedNet   float64
	}{
		{
			name:          "Standard calculation",
			capital:       250000,
			rate:          4.55,
			taxRate:       10,
			expectedGross: 947.92,
			expectedTax:   94.79,
			expectedNet:   853.13,
		},
		{
			name:          "Zero tax rate",
			capital:       100000,
			rate:          5,
			taxRate:       0,
			expectedGross: 416.67,
			expectedTax:   0,
			expectedNet:   416.67,
		},
		{
			name:          "High interest rate",
			capital:       100000,
			rate:          12,
			taxRate:       10,
			expectedGross: 1000.00,
			expectedTax:   100.00,
			expectedNet:   900.00,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := calculator.CalculateMonthlyPayment(tt.capital, tt.rate, tt.taxRate)
			assert.Equal(t, tt.expectedGross, result.GrossInterest)
			assert.Equal(t, tt.expectedTax, result.TaxWithheld)
			assert.Equal(t, tt.expectedNet, result.NetInterest)
			assert.Equal(t, tt.capital, result.AppliedCapital)
		})
	}
}

func TestCreateCertificate(t *testing.T) {
	mockRepo := &MockCertificateRepository{}
	service := NewCertificateService(mockRepo, nil)
	ctx := context.Background()

	payoutAccountId := "account-123"
	req := &dto.CreateCertificateRequest{
		Bank:                "Test Bank",
		BaseCapital:         100000,
		InterestType:        "simple",
		CurrentInterestRate: 5.0,
		CurrentTaxRate:      10.0,
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
	service := NewCertificateService(mockRepo, nil)
	ctx := context.Background()

	payoutAccountId := "account-123"
	req := &dto.CreateCertificateRequest{
		Bank:                "Test Bank",
		BaseCapital:         100000,
		InterestType:        "compound",
		CurrentInterestRate: 5.0,
		CurrentTaxRate:      10.0,
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
	service := NewCertificateService(mockRepo, nil)
	ctx := context.Background()

	req := &dto.CreateCertificateRequest{
		Bank:                "Test Bank",
		BaseCapital:         100000,
		InterestType:        "simple",
		CurrentInterestRate: 5.0,
		CurrentTaxRate:      10.0,
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
	service := NewCertificateService(mockRepo, nil)
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
	service := NewCertificateService(mockRepo, nil)

	cert := &certificate.Certificate{
		UserId:       "user-123",
		BaseCapital:  100000,
		InterestType: certificate.InterestTypeSimple,
	}

	mockRepo.On("FindLastPayment", mock.Anything, mock.Anything).Return(nil, sql.ErrNoRows)

	effectiveCapital, _ := service.GetEffectiveCapital(cert)
	assert.Equal(t, cert.BaseCapital, effectiveCapital)
}

func TestGetEffectiveCapital_CompoundWithoutReinvest(t *testing.T) {
	mockRepo := &MockCertificateRepository{}
	service := NewCertificateService(mockRepo, nil)

	cert := &certificate.Certificate{
		UserId:           "user-123",
		BaseCapital:      100000,
		InterestType:     certificate.InterestTypeCompound,
		ReinvestInterest: false,
	}

	mockRepo.On("FindLastPayment", mock.Anything, mock.Anything).Return(nil, sql.ErrNoRows)

	effectiveCapital, _ := service.GetEffectiveCapital(cert)
	assert.Equal(t, cert.BaseCapital, effectiveCapital)
}

func TestSimulate(t *testing.T) {
	mockRepo := &MockCertificateRepository{}
	service := NewCertificateService(mockRepo, nil)
	ctx := context.Background()

	cert := &certificate.Certificate{
		Id:                  "cert-123",
		UserId:              "user-123",
		BaseCapital:         100000,
		InterestType:        certificate.InterestTypeSimple,
		CurrentInterestRate: 5.0,
		CurrentTaxRate:      10.0,
	}

	mockRepo.On("FindById", ctx, cert.Id, cert.UserId).Return(cert, nil)

	req := &dto.SimulatePaymentRequest{
		Months: 12,
	}

	result, err := service.Simulate(ctx, cert.Id, req, cert.UserId)
	assert.NoError(t, err)
	assert.Len(t, result.Payments, 12)
	assert.Greater(t, result.Totals.NetInterest, 0.0)
	mockRepo.AssertExpectations(t)
}

func TestSimulate_CompoundWithReinvest(t *testing.T) {
	mockRepo := &MockCertificateRepository{}
	service := NewCertificateService(mockRepo, nil)
	ctx := context.Background()

	cert := &certificate.Certificate{
		Id:                  "cert-123",
		UserId:              "user-123",
		BaseCapital:         100000,
		InterestType:        certificate.InterestTypeCompound,
		CurrentInterestRate: 5.0,
		CurrentTaxRate:      10.0,
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
	assert.Less(t, result.Payments[0].NetInterest, result.Payments[1].NetInterest)
	assert.Less(t, result.Payments[1].NetInterest, result.Payments[2].NetInterest)

	mockRepo.AssertExpectations(t)
}
