package certificate

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/osmait/gestorDePresupuesto/internal/domain/account"
	"github.com/osmait/gestorDePresupuesto/internal/domain/certificate"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
	dto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/certificate"
	"github.com/osmait/gestorDePresupuesto/internal/platform/i18n"
	certificateRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/certificate"
	"github.com/osmait/gestorDePresupuesto/internal/services/errorhttp"
	"github.com/rs/zerolog/log"
	"github.com/segmentio/ksuid"
)

var (
	// ErrCertificateNotFound is returned when a certificate does not exist or belongs to another user.
	ErrCertificateNotFound = fmt.Errorf("%w: certificate not found", errorhttp.ErrNotFound)
	// ErrPaymentNotFound is returned when a certificate payment does not exist or belongs to another user.
	ErrPaymentNotFound = fmt.Errorf("%w: payment not found", errorhttp.ErrNotFound)
	// ErrPayoutAccountNotFound is returned when the payout account is not one of the user's accounts.
	ErrPayoutAccountNotFound = fmt.Errorf("%w: payout account not found", errorhttp.ErrBadRequest)
	// ErrCreditCardPayoutAccount is returned when a credit card account is used
	// as the account that funds a certificate / receives its interest.
	ErrCreditCardPayoutAccount = fmt.Errorf("%w: a credit card account cannot be used as the funding/payout account of a certificate", errorhttp.ErrBadRequest)
)

func isNotFound(err error) bool {
	return errors.Is(err, sql.ErrNoRows) || errors.Is(err, errorhttp.ErrNotFound)
}

type TransactionCreator interface {
	CreateTransaction(ctx context.Context, name, description string, amount money.Amount, typeTransaction string, accountId string, userId string, categoryId string, budgetId string, currency string, createdAt time.Time) error
}

// AccountFinder looks up one of the user's accounts.
type AccountFinder interface {
	FindByIdAndUserId(ctx context.Context, id string, userId string) (*account.Account, error)
}

type CertificateService struct {
	repository         certificateRepo.CertificateRepositoryInterface
	transactionService TransactionCreator
	accountRepository  AccountFinder
}

// NewCertificateService builds the service. accountRepository validates the
// payout account; when nil (unit tests) that validation is skipped.
func NewCertificateService(repository certificateRepo.CertificateRepositoryInterface, transactionService TransactionCreator, accountRepository AccountFinder) *CertificateService {
	return &CertificateService{
		repository:         repository,
		transactionService: transactionService,
		accountRepository:  accountRepository,
	}
}

// validatePayoutAccount rejects a payout account that is not the user's or
// that is a credit card (interest cannot be paid into / funded from a card).
func (s *CertificateService) validatePayoutAccount(ctx context.Context, payoutAccountId *string, userId string) error {
	if payoutAccountId == nil || *payoutAccountId == "" || s.accountRepository == nil {
		return nil
	}
	acc, err := s.accountRepository.FindByIdAndUserId(ctx, *payoutAccountId, userId)
	if err != nil {
		if isNotFound(err) {
			return ErrPayoutAccountNotFound
		}
		return err
	}
	if acc.Type == account.AccountTypeCreditCard {
		return ErrCreditCardPayoutAccount
	}
	return nil
}

type PaymentCalculator struct{}

type PaymentResult struct {
	GrossInterest  money.Amount
	TaxWithheld    money.Amount
	NetInterest    money.Amount
	AppliedCapital money.Amount
}

// CalculateMonthlyPayment computes one month of interest. Rates are
// percentages (annual interest, tax on interest). Gross interest and tax are
// derived amounts, each rounded half-even to cents; net interest is then
// gross - tax exactly, so the three always reconcile (gross == tax + net).
func (c *PaymentCalculator) CalculateMonthlyPayment(capital, rate, taxRate money.Amount) PaymentResult {
	grossInterest := capital.Mul(rate).DivInt(1200).RoundCents()
	taxWithheld := grossInterest.Mul(taxRate).DivInt(100).RoundCents()
	netInterest := grossInterest.Sub(taxWithheld)

	return PaymentResult{
		GrossInterest:  grossInterest,
		TaxWithheld:    taxWithheld,
		NetInterest:    netInterest,
		AppliedCapital: capital,
	}
}

func (s *CertificateService) CreateCertificate(ctx context.Context, req *dto.CreateCertificateRequest, userId string) error {
	if err := req.Validate(); err != nil {
		log.Error().Err(err).Str("user_id", userId).Msg("Certificate validation failed")
		return err
	}

	if err := s.validatePayoutAccount(ctx, req.PayoutAccountId, userId); err != nil {
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

		effectiveCapital, lastPayment := s.GetEffectiveCapital(ctx, cert)
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
		if isNotFound(err) {
			return nil, ErrCertificateNotFound
		}
		return nil, err
	}

	payments, err := s.repository.FindPaymentsByCertificate(ctx, id, userId)
	if err != nil {
		return nil, err
	}

	calculator := &PaymentCalculator{}
	effectiveCapital, _ := s.GetEffectiveCapital(ctx, cert)
	nextPaymentDate := s.CalculateNextPaymentDate(cert, nil)
	projected := s.GetProjectedPayment(cert, effectiveCapital, calculator)

	if cert.MaturityDate != nil && nextPaymentDate != nil && nextPaymentDate.After(*cert.MaturityDate) {
		nextPaymentDate = nil
		projected = nil
	}

	certResponse := dto.NewCertificateResponse(cert, effectiveCapital, nextPaymentDate, projected)

	paymentResponses := make([]dto.PaymentResponse, 0, len(payments))
	var totalGross, totalTax, totalNet money.Amount
	for _, p := range payments {
		paymentResponses = append(paymentResponses, *dto.NewPaymentResponse(p))
		totalGross = totalGross.Add(p.GrossInterest)
		totalTax = totalTax.Add(p.TaxWithheld)
		totalNet = totalNet.Add(p.NetInterest)
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
	if err := req.Validate(); err != nil {
		return fmt.Errorf("%w: %s", errorhttp.ErrBadRequest, err.Error())
	}
	cert, err := s.repository.FindById(ctx, id, userId)
	if err != nil {
		if isNotFound(err) {
			return ErrCertificateNotFound
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
		if err := s.validatePayoutAccount(ctx, req.PayoutAccountId, userId); err != nil {
			return err
		}
		cert.PayoutAccountId = req.PayoutAccountId
	}
	if req.Status != nil {
		cert.Status = *req.Status
	}
	cert.UpdatedAt = time.Now()
	// Ownership is fixed by the scoped lookup above.
	cert.Id = id
	cert.UserId = userId

	if err := s.repository.Update(ctx, cert); err != nil {
		if isNotFound(err) {
			return ErrCertificateNotFound
		}
		return err
	}
	return nil
}

func (s *CertificateService) UpdatePayment(ctx context.Context, paymentId string, req *dto.UpdateCertificatePaymentRequest, userId string) error {
	if err := req.Validate(); err != nil {
		return fmt.Errorf("%w: %s", errorhttp.ErrBadRequest, err.Error())
	}
	payment, err := s.repository.FindPaymentById(ctx, paymentId, userId)
	if err != nil {
		if isNotFound(err) {
			return ErrPaymentNotFound
		}
		return err
	}

	if req.PaymentDate != nil {
		t, err := time.Parse("2006-01-02", *req.PaymentDate)
		if err != nil {
			return fmt.Errorf("%w: invalid payment_date format, expected YYYY-MM-DD", errorhttp.ErrBadRequest)
		}
		payment.PaymentDate = t
	}
	if req.PeriodStart != nil {
		t, err := time.Parse("2006-01-02", *req.PeriodStart)
		if err != nil {
			return fmt.Errorf("%w: invalid period_start format, expected YYYY-MM-DD", errorhttp.ErrBadRequest)
		}
		payment.PeriodStart = t
	}
	if req.PeriodEnd != nil {
		t, err := time.Parse("2006-01-02", *req.PeriodEnd)
		if err != nil {
			return fmt.Errorf("%w: invalid period_end format, expected YYYY-MM-DD", errorhttp.ErrBadRequest)
		}
		payment.PeriodEnd = t
	}
	if req.GrossInterest != nil {
		payment.GrossInterest = *req.GrossInterest
	}
	if req.TaxWithheld != nil {
		payment.TaxWithheld = *req.TaxWithheld
	}
	if req.NetInterest != nil {
		payment.NetInterest = *req.NetInterest
	}
	if req.AppliedRate != nil {
		payment.AppliedRate = *req.AppliedRate
	}
	if req.AppliedTaxRate != nil {
		payment.AppliedTaxRate = *req.AppliedTaxRate
	}
	if req.AppliedCapital != nil {
		payment.AppliedCapital = *req.AppliedCapital
	}

	now := time.Now()
	payment.UpdatedAt = &now
	payment.UserId = userId

	if err := s.repository.UpdatePayment(ctx, payment); err != nil {
		if isNotFound(err) {
			return ErrPaymentNotFound
		}
		return err
	}
	return nil
}

func (s *CertificateService) DeleteCertificate(ctx context.Context, id string, userId string) error {
	if err := s.repository.Delete(ctx, id, userId); err != nil {
		if isNotFound(err) {
			return ErrCertificateNotFound
		}
		return err
	}
	return nil
}

func (s *CertificateService) Simulate(ctx context.Context, id string, req *dto.SimulatePaymentRequest, userId string) (*dto.SimulationResponse, error) {
	cert, err := s.repository.FindById(ctx, id, userId)
	if err != nil {
		if isNotFound(err) {
			return nil, ErrCertificateNotFound
		}
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
	var totalGross, totalTax, totalNet money.Amount

	currentCapital := capital
	for i := 0; i < months; i++ {
		result := calculator.CalculateMonthlyPayment(currentCapital, rate, taxRate)
		payments = append(payments, dto.ProjectedPaymentResponse{
			GrossInterest: result.GrossInterest,
			TaxWithheld:   result.TaxWithheld,
			NetInterest:   result.NetInterest,
		})
		totalGross = totalGross.Add(result.GrossInterest)
		totalTax = totalTax.Add(result.TaxWithheld)
		totalNet = totalNet.Add(result.NetInterest)

		if cert.InterestType == certificate.InterestTypeCompound && cert.ReinvestInterest {
			currentCapital = currentCapital.Add(result.NetInterest)
		}
	}

	return &dto.SimulationResponse{
		Payments: payments,
		Totals: dto.SimulationTotals{
			GrossInterest: totalGross.RoundCents(),
			TaxWithheld:   totalTax.RoundCents(),
			NetInterest:   totalNet.RoundCents(),
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

		lastPayment, err := s.repository.FindLastPayment(ctx, cert.Id, userId)
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
				_ = s.repository.UpdateStatus(ctx, cert.Id, userId, certificate.StatusMatured)
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
				transactionName := i18n.T(ctx, i18n.CertificateInterestName, cert.Bank)
				transactionDesc := i18n.T(ctx, i18n.CertificateInterestDescription, periodStart.Format("2006-01-02"), periodEnd.Format("2006-01-02"))
				_ = s.transactionService.CreateTransaction(ctx, transactionName, transactionDesc, result.NetInterest, "income", *cert.PayoutAccountId, userId, "", "", cert.Currency, nextPaymentDate)
			}

			lastPayment = payment
			startDate = nextPaymentDate
		}
	}

	return nil
}

// GetEffectiveCapital returns the capital interest is computed on. ctx must
// be the caller's context: inside an HTTP request it carries the RLS
// transaction, and querying with a detached context would need a second
// pooled connection while the request holds one (pool deadlock under load).
func (s *CertificateService) GetEffectiveCapital(ctx context.Context, cert *certificate.Certificate) (money.Amount, *certificate.CertificatePayment) {
	if cert.InterestType == certificate.InterestTypeSimple {
		return cert.BaseCapital, nil
	}

	lastPayment, err := s.repository.FindLastPayment(ctx, cert.Id, cert.UserId)
	if err != nil {
		return cert.BaseCapital, nil
	}

	if cert.ReinvestInterest {
		return lastPayment.AppliedCapital.Add(lastPayment.NetInterest), lastPayment
	}

	return cert.BaseCapital, lastPayment
}

func (s *CertificateService) getEffectiveCapitalForPayment(cert *certificate.Certificate, lastPayment *certificate.CertificatePayment) money.Amount {
	if cert.InterestType == certificate.InterestTypeSimple {
		return cert.BaseCapital
	}

	if lastPayment == nil {
		return cert.BaseCapital
	}

	if cert.ReinvestInterest {
		return lastPayment.AppliedCapital.Add(lastPayment.NetInterest)
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

func (s *CertificateService) GetProjectedPayment(cert *certificate.Certificate, capital money.Amount, calculator *PaymentCalculator) *dto.ProjectedPaymentResponse {
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

	var totalCapital, totalGross, totalTax, totalNet money.Amount
	activeCount := 0

	for _, cert := range certificates {
		if cert.Status == certificate.StatusActive {
			totalCapital = totalCapital.Add(cert.BaseCapital)
			activeCount++
		}
	}

	for _, p := range payments {
		totalGross = totalGross.Add(p.GrossInterest)
		totalTax = totalTax.Add(p.TaxWithheld)
		totalNet = totalNet.Add(p.NetInterest)
	}

	return &dto.CertificateSummaryResponse{
		TotalCapital:       totalCapital,
		TotalGrossInterest: totalGross,
		TotalTaxWithheld:   totalTax,
		TotalNetInterest:   totalNet,
		PortfolioValue:     totalCapital.Add(totalNet),
		ActiveCertificates: activeCount,
	}, nil
}
