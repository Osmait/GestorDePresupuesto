package certificate

import (
	"context"
	"database/sql"
	"errors"
	"math"
	"time"

	"github.com/osmait/gestorDePresupuesto/internal/domain/certificate"
	dto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/certificate"
	certificateRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/certificate"
	"github.com/rs/zerolog/log"
	"github.com/segmentio/ksuid"
)

type TransactionCreator interface {
	CreateTransaction(ctx context.Context, name, description string, amount float64, typeTransaction string, accountId string, userId string, categoryId string, budgetId string, currency string, createdAt time.Time) error
}

type CertificateService struct {
	repository         certificateRepo.CertificateRepositoryInterface
	transactionService TransactionCreator
}

func NewCertificateService(repository certificateRepo.CertificateRepositoryInterface, transactionService TransactionCreator) *CertificateService {
	return &CertificateService{
		repository:         repository,
		transactionService: transactionService,
	}
}

type PaymentCalculator struct{}

type PaymentResult struct {
	GrossInterest  float64
	TaxWithheld    float64
	NetInterest    float64
	AppliedCapital float64
}

func (c *PaymentCalculator) CalculateMonthlyPayment(capital, rate, taxRate float64) PaymentResult {
	grossInterest := capital * (rate / 100) / 12
	taxWithheld := grossInterest * (taxRate / 100)
	netInterest := grossInterest - taxWithheld

	return PaymentResult{
		GrossInterest:  math.Round(grossInterest*100) / 100,
		TaxWithheld:    math.Round(taxWithheld*100) / 100,
		NetInterest:    math.Round(netInterest*100) / 100,
		AppliedCapital: capital,
	}
}

func (s *CertificateService) CreateCertificate(ctx context.Context, req *dto.CreateCertificateRequest, userId string) error {
	if err := req.Validate(); err != nil {
		log.Error().Err(err).Str("user_id", userId).Msg("Certificate validation failed")
		return err
	}

	uuid, err := ksuid.NewRandom()
	if err != nil {
		log.Error().Err(err).Str("user_id", userId).Msg("Failed to generate certificate ID")
		return err
	}
	id := uuid.String()

	cert := certificate.NewCertificate(id, userId, req.Bank, req.BaseCapital, req.GetInterestType(), req.CurrentInterestRate, req.CurrentTaxRate, req.CutDay)
	cert.ReinvestInterest = req.ReinvestInterest
	cert.PayoutAccountId = req.PayoutAccountId
	cert.MaturityDate = req.GetMaturityDate()
	if req.Currency != "" {
		cert.Currency = req.Currency
	}

	log.Info().
		Str("id", id).
		Str("user_id", userId).
		Str("bank", req.Bank).
		Msg("Creating certificate")

	if err := s.repository.Save(ctx, cert); err != nil {
		log.Error().Err(err).
			Str("id", id).
			Str("user_id", userId).
			Interface("payout_account_id", req.PayoutAccountId).
			Msg("Failed to save certificate")
		return err
	}

	log.Info().Str("id", id).Str("user_id", userId).Msg("Certificate created successfully")
	return nil
}

func (s *CertificateService) FindAll(ctx context.Context, userId string) ([]*dto.CertificateResponse, error) {
	if err := s.ProcessPendingPayments(ctx, userId); err != nil {
		return nil, err
	}

	certificates, err := s.repository.FindAll(ctx, userId)
	if err != nil {
		return nil, err
	}

	var responses []*dto.CertificateResponse
	calculator := &PaymentCalculator{}

	for _, cert := range certificates {
		if cert.Status == certificate.StatusCancelled {
			continue
		}

		effectiveCapital, lastPayment := s.GetEffectiveCapital(cert)
		nextPaymentDate := s.CalculateNextPaymentDate(cert, lastPayment)
		projected := s.GetProjectedPayment(cert, effectiveCapital, calculator)

		if cert.MaturityDate != nil && nextPaymentDate != nil && nextPaymentDate.After(*cert.MaturityDate) {
			nextPaymentDate = nil
			projected = nil
		}

		response := dto.NewCertificateResponse(cert, effectiveCapital, nextPaymentDate, projected)
		responses = append(responses, response)
	}

	return responses, nil
}

func (s *CertificateService) FindById(ctx context.Context, id string, userId string) (*dto.CertificateWithHistoryResponse, error) {
	if err := s.ProcessPendingPayments(ctx, userId); err != nil {
		return nil, err
	}

	cert, err := s.repository.FindById(ctx, id, userId)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("certificate not found")
		}
		return nil, err
	}

	payments, err := s.repository.FindPaymentsByCertificate(ctx, id)
	if err != nil {
		return nil, err
	}

	calculator := &PaymentCalculator{}
	effectiveCapital, _ := s.GetEffectiveCapital(cert)
	nextPaymentDate := s.CalculateNextPaymentDate(cert, nil)
	projected := s.GetProjectedPayment(cert, effectiveCapital, calculator)

	if cert.MaturityDate != nil && nextPaymentDate != nil && nextPaymentDate.After(*cert.MaturityDate) {
		nextPaymentDate = nil
		projected = nil
	}

	certResponse := dto.NewCertificateResponse(cert, effectiveCapital, nextPaymentDate, projected)

	paymentResponses := make([]dto.PaymentResponse, 0, len(payments))
	var totalGross, totalTax, totalNet float64
	for _, p := range payments {
		paymentResponses = append(paymentResponses, *dto.NewPaymentResponse(p))
		totalGross += p.GrossInterest
		totalTax += p.TaxWithheld
		totalNet += p.NetInterest
	}

	summary := dto.CertificateSummaryResponse{
		TotalGrossInterest: totalGross,
		TotalTaxWithheld:   totalTax,
		TotalNetInterest:   totalNet,
	}

	return &dto.CertificateWithHistoryResponse{
		CertificateResponse: *certResponse,
		Payments:            paymentResponses,
		Summary:             summary,
	}, nil
}

func (s *CertificateService) UpdateCertificate(ctx context.Context, id string, req *dto.UpdateCertificateRequest, userId string) error {
	cert, err := s.repository.FindById(ctx, id, userId)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return errors.New("certificate not found")
		}
		return err
	}

	if req.Bank != nil {
		cert.Bank = *req.Bank
	}
	if req.BaseCapital != nil {
		cert.BaseCapital = *req.BaseCapital
	}
	if req.CurrentInterestRate != nil {
		cert.CurrentInterestRate = *req.CurrentInterestRate
	}
	if req.CurrentTaxRate != nil {
		cert.CurrentTaxRate = *req.CurrentTaxRate
	}
	if req.CutDay != nil {
		cert.CutDay = *req.CutDay
	}
	if req.ReinvestInterest != nil {
		cert.ReinvestInterest = *req.ReinvestInterest
	}
	if req.PayoutAccountId != nil {
		cert.PayoutAccountId = req.PayoutAccountId
	}
	if req.Status != nil {
		cert.Status = *req.Status
	}
	cert.UpdatedAt = time.Now()

	return s.repository.Update(ctx, cert)
}

func (s *CertificateService) DeleteCertificate(ctx context.Context, id string, userId string) error {
	return s.repository.Delete(ctx, id, userId)
}

func (s *CertificateService) Simulate(ctx context.Context, id string, req *dto.SimulatePaymentRequest, userId string) (*dto.SimulationResponse, error) {
	cert, err := s.repository.FindById(ctx, id, userId)
	if err != nil {
		return nil, err
	}

	capital := cert.BaseCapital
	rate := cert.CurrentInterestRate
	taxRate := cert.CurrentTaxRate
	months := req.Months
	if months == 0 {
		months = 1
	}

	if req.Capital != nil {
		capital = *req.Capital
	}
	if req.Rate != nil {
		rate = *req.Rate
	}
	if req.TaxRate != nil {
		taxRate = *req.TaxRate
	}

	calculator := &PaymentCalculator{}
	var payments []dto.ProjectedPaymentResponse
	var totalGross, totalTax, totalNet float64

	currentCapital := capital
	for i := 0; i < months; i++ {
		result := calculator.CalculateMonthlyPayment(currentCapital, rate, taxRate)
		payments = append(payments, dto.ProjectedPaymentResponse{
			GrossInterest: result.GrossInterest,
			TaxWithheld:   result.TaxWithheld,
			NetInterest:   result.NetInterest,
		})
		totalGross += result.GrossInterest
		totalTax += result.TaxWithheld
		totalNet += result.NetInterest

		if cert.InterestType == certificate.InterestTypeCompound && cert.ReinvestInterest {
			currentCapital += result.NetInterest
		}
	}

	return &dto.SimulationResponse{
		Payments: payments,
		Totals: dto.SimulationTotals{
			GrossInterest: math.Round(totalGross*100) / 100,
			TaxWithheld:   math.Round(totalTax*100) / 100,
			NetInterest:   math.Round(totalNet*100) / 100,
		},
	}, nil
}

func (s *CertificateService) ProcessPendingPayments(ctx context.Context, userId string) error {
	certificates, err := s.repository.FindActiveByUser(ctx, userId)
	if err != nil {
		return err
	}

	now := time.Now()
	calculator := &PaymentCalculator{}

	for _, cert := range certificates {
		if cert.Status != certificate.StatusActive {
			continue
		}

		lastPayment, err := s.repository.FindLastPayment(ctx, cert.Id)
		if err != nil && !errors.Is(err, sql.ErrNoRows) {
			continue
		}

		var startDate time.Time
		if lastPayment != nil {
			startDate = lastPayment.PaymentDate
		} else {
			startDate = cert.CreatedAt
		}

		for {
			nextPaymentDate := s.calculateNextPaymentDate(startDate, cert.CutDay)

			if nextPaymentDate.After(now) {
				break
			}

			if cert.MaturityDate != nil && nextPaymentDate.After(*cert.MaturityDate) {
				_ = s.repository.UpdateStatus(ctx, cert.Id, certificate.StatusMatured)
				break
			}

			effectiveCapital := s.getEffectiveCapitalForPayment(cert, lastPayment)
			result := calculator.CalculateMonthlyPayment(effectiveCapital, cert.CurrentInterestRate, cert.CurrentTaxRate)

			uuid, _ := ksuid.NewRandom()
			periodStart := startDate
			periodEnd := nextPaymentDate

			payment := certificate.NewCertificatePayment(
				uuid.String(),
				cert.Id,
				userId,
				nextPaymentDate,
				periodStart,
				periodEnd,
				result.GrossInterest,
				result.TaxWithheld,
				result.NetInterest,
				cert.CurrentInterestRate,
				cert.CurrentTaxRate,
				result.AppliedCapital,
			)
			payment.PayoutAccountId = cert.PayoutAccountId

			if err := s.repository.SavePayment(ctx, payment); err != nil {
				break
			}

			if cert.InterestType == certificate.InterestTypeSimple && cert.PayoutAccountId != nil && s.transactionService != nil {
				transactionName := cert.Bank + " - Interest Payment"
				transactionDesc := "Certificate interest payment for period " + periodStart.Format("2006-01-02") + " to " + periodEnd.Format("2006-01-02")
				_ = s.transactionService.CreateTransaction(ctx, transactionName, transactionDesc, result.NetInterest, "income", *cert.PayoutAccountId, userId, "", "", cert.Currency, nextPaymentDate)
			}

			lastPayment = payment
			startDate = nextPaymentDate
		}
	}

	return nil
}

func (s *CertificateService) GetEffectiveCapital(cert *certificate.Certificate) (float64, *certificate.CertificatePayment) {
	if cert.InterestType == certificate.InterestTypeSimple {
		return cert.BaseCapital, nil
	}

	lastPayment, err := s.repository.FindLastPayment(context.Background(), cert.Id)
	if err != nil {
		return cert.BaseCapital, nil
	}

	if cert.ReinvestInterest {
		return lastPayment.AppliedCapital + lastPayment.NetInterest, lastPayment
	}

	return cert.BaseCapital, lastPayment
}

func (s *CertificateService) getEffectiveCapitalForPayment(cert *certificate.Certificate, lastPayment *certificate.CertificatePayment) float64 {
	if cert.InterestType == certificate.InterestTypeSimple {
		return cert.BaseCapital
	}

	if lastPayment == nil {
		return cert.BaseCapital
	}

	if cert.ReinvestInterest {
		return lastPayment.AppliedCapital + lastPayment.NetInterest
	}

	return cert.BaseCapital
}

func (s *CertificateService) CalculateNextPaymentDate(cert *certificate.Certificate, lastPayment *certificate.CertificatePayment) *time.Time {
	var startDate time.Time
	if lastPayment != nil {
		startDate = lastPayment.PaymentDate
	} else {
		startDate = cert.CreatedAt
	}

	nextDate := s.calculateNextPaymentDate(startDate, cert.CutDay)
	return &nextDate
}

func (s *CertificateService) calculateNextPaymentDate(from time.Time, cutDay int) time.Time {
	year, month, _ := from.Date()

	if from.Day() >= cutDay {
		month++
		if month > 12 {
			month = 1
			year++
		}
	}

	daysInMonth := time.Date(year, month+1, 0, 0, 0, 0, 0, from.Location()).Day()
	day := cutDay
	if day > daysInMonth {
		day = daysInMonth
	}

	return time.Date(year, month, day, 0, 0, 0, 0, from.Location())
}

func (s *CertificateService) GetProjectedPayment(cert *certificate.Certificate, capital float64, calculator *PaymentCalculator) *dto.ProjectedPaymentResponse {
	result := calculator.CalculateMonthlyPayment(capital, cert.CurrentInterestRate, cert.CurrentTaxRate)
	return &dto.ProjectedPaymentResponse{
		GrossInterest: result.GrossInterest,
		TaxWithheld:   result.TaxWithheld,
		NetInterest:   result.NetInterest,
	}
}

func (s *CertificateService) GetSummary(ctx context.Context, userId string) (*dto.CertificateSummaryResponse, error) {
	certificates, err := s.repository.FindAll(ctx, userId)
	if err != nil {
		return nil, err
	}

	payments, err := s.repository.FindAllPayments(ctx, userId)
	if err != nil {
		return nil, err
	}

	var totalCapital, totalGross, totalTax, totalNet float64
	activeCount := 0

	for _, cert := range certificates {
		if cert.Status == certificate.StatusActive {
			totalCapital += cert.BaseCapital
			activeCount++
		}
	}

	for _, p := range payments {
		totalGross += p.GrossInterest
		totalTax += p.TaxWithheld
		totalNet += p.NetInterest
	}

	return &dto.CertificateSummaryResponse{
		TotalCapital:       totalCapital,
		TotalGrossInterest: totalGross,
		TotalTaxWithheld:   totalTax,
		TotalNetInterest:   totalNet,
		PortfolioValue:     totalCapital + totalNet,
		ActiveCertificates: activeCount,
	}, nil
}
