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
	"github.com/osmait/gestorDePresupuesto/internal/platform/apptime"
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
	// ErrUnsupportedCurrency is returned for a certificate currency other than DOP or USD.
	ErrUnsupportedCurrency = fmt.Errorf("%w: currency must be DOP or USD", errorhttp.ErrBadRequest)
	// errPayoutRateUnavailable is a payout that needs a conversion while the
	// exchange rate is unavailable: it is retried on the next read.
	errPayoutRateUnavailable = errors.New("exchange rate unavailable to convert the interest into the payout account currency")
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
	loc                *time.Location
	usdToDopRateFn     func(context.Context) (money.Amount, error)
}

// NewCertificateService builds the service. accountRepository validates the
// payout account; when nil (unit tests) that validation is skipped.
// Option configures a CertificateService.
type Option func(*CertificateService)

// WithLocation sets the app time zone that payment days are cut in (default
// apptime.Default()).
func WithLocation(loc *time.Location) Option {
	return func(s *CertificateService) {
		if loc != nil {
			s.loc = loc
		}
	}
}

// WithUsdToDopRate sets the USD->DOP rate source. It converts the interest of
// a certificate paid into an account of the other currency (no fallback: a
// payout is never converted at a guessed rate) and the DOP totals of the
// summary (money.FallbackUsdToDopRate when unavailable, like the dashboard).
func WithUsdToDopRate(fn func(context.Context) (money.Amount, error)) Option {
	return func(s *CertificateService) {
		s.usdToDopRateFn = fn
	}
}

func NewCertificateService(repository certificateRepo.CertificateRepositoryInterface, transactionService TransactionCreator, accountRepository AccountFinder, opts ...Option) *CertificateService {
	s := &CertificateService{
		repository:         repository,
		transactionService: transactionService,
		accountRepository:  accountRepository,
		loc:                apptime.Default(),
	}
	for _, opt := range opts {
		opt(s)
	}
	return s
}

// calendarDay returns t's calendar day as 12:00 UTC, the convention for
// date-only values (the same day in UTC and in the app time zone). A legacy
// date-only value stored at 00:00 UTC keeps its UTC day; any other instant
// (e.g. a certificate's created_at) is the day it is in the app time zone.
func (s *CertificateService) calendarDay(t time.Time) time.Time {
	y, m, d := apptime.NormalizeMidnightUTC(t).In(apptime.OrDefault(s.loc)).Date()
	return apptime.NoonUTC(y, m, d)
}

// afterMaturity reports whether a payment date falls after the maturity day.
func (s *CertificateService) afterMaturity(paymentDate time.Time, maturity *time.Time) bool {
	return maturity != nil && s.calendarDay(paymentDate).After(s.calendarDay(*maturity))
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
	cert.Currency = money.NormalizeCurrency(req.Currency, money.CurrencyDOP)
	if !money.IsSupportedCurrency(cert.Currency) {
		return ErrUnsupportedCurrency
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
	payoutErrors, err := s.processPendingPayments(ctx, userId)
	if err != nil {
		return nil, err
	}

	certificates, err := s.repository.FindAll(ctx, userId)
	if err != nil {
		return nil, err
	}

	// The last payment of every compound certificate (see GetEffectiveCapital),
	// in one query.
	var compoundIds []string
	for _, cert := range certificates {
		if cert.Status != certificate.StatusCancelled && cert.InterestType != certificate.InterestTypeSimple {
			compoundIds = append(compoundIds, cert.Id)
		}
	}
	lastPayments, err := s.repository.FindLastPayments(ctx, compoundIds, userId)
	if err != nil {
		return nil, err
	}

	var responses []*dto.CertificateResponse
	calculator := &PaymentCalculator{}

	for _, cert := range certificates {
		if cert.Status == certificate.StatusCancelled {
			continue
		}

		effectiveCapital, lastPayment := effectiveCapitalWith(cert, lastPayments[cert.Id])
		nextPaymentDate := s.CalculateNextPaymentDate(cert, lastPayment)
		projected := s.GetProjectedPayment(cert, effectiveCapital, calculator)

		if nextPaymentDate != nil && s.afterMaturity(*nextPaymentDate, cert.MaturityDate) {
			nextPaymentDate = nil
			projected = nil
		}

		response := dto.NewCertificateResponse(cert, effectiveCapital, nextPaymentDate, projected)
		response.PayoutError = payoutErrors[cert.Id]
		responses = append(responses, response)
	}

	return responses, nil
}

func (s *CertificateService) FindById(ctx context.Context, id string, userId string) (*dto.CertificateWithHistoryResponse, error) {
	payoutErrors, err := s.processPendingPayments(ctx, userId)
	if err != nil {
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

	if nextPaymentDate != nil && s.afterMaturity(*nextPaymentDate, cert.MaturityDate) {
		nextPaymentDate = nil
		projected = nil
	}

	certResponse := dto.NewCertificateResponse(cert, effectiveCapital, nextPaymentDate, projected)
	certResponse.PayoutError = payoutErrors[cert.Id]

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

	// Date-only values are calendar days at 12:00 UTC (see apptime).
	if req.PaymentDate != nil {
		t, err := time.Parse("2006-01-02", *req.PaymentDate)
		if err != nil {
			return fmt.Errorf("%w: invalid payment_date format, expected YYYY-MM-DD", errorhttp.ErrBadRequest)
		}
		payment.PaymentDate = apptime.NoonUTC(t.Date())
	}
	if req.PeriodStart != nil {
		t, err := time.Parse("2006-01-02", *req.PeriodStart)
		if err != nil {
			return fmt.Errorf("%w: invalid period_start format, expected YYYY-MM-DD", errorhttp.ErrBadRequest)
		}
		payment.PeriodStart = apptime.NoonUTC(t.Date())
	}
	if req.PeriodEnd != nil {
		t, err := time.Parse("2006-01-02", *req.PeriodEnd)
		if err != nil {
			return fmt.Errorf("%w: invalid period_end format, expected YYYY-MM-DD", errorhttp.ErrBadRequest)
		}
		payment.PeriodEnd = apptime.NoonUTC(t.Date())
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

// ProcessPendingPayments records the interest payments due up to now on the
// user's active certificates (see processPendingPayments).
func (s *CertificateService) ProcessPendingPayments(ctx context.Context, userId string) error {
	_, err := s.processPendingPayments(ctx, userId)
	return err
}

// payout is where a certificate's interest is credited: an income
// transaction on accountID, in accountCurrency. rate is the USD->DOP rate
// when the certificate's currency differs from the account's.
type payout struct {
	accountID       string
	accountCurrency string
	certCurrency    string
	rate            money.Amount
}

// amount converts net interest to the account currency, rounded half-even to
// cents.
func (p payout) amount(net money.Amount) money.Amount {
	converted, _ := money.Convert(net, p.certCurrency, p.accountCurrency, p.rate)
	return converted.RoundCents()
}

// resolvePayout returns where cert pays its interest, or nil when it does not
// pay it out (it capitalizes it, or has no payout account). The interest is
// converted when the account is in the other currency (a USD certificate
// paying into a DOP account): the transaction service only accepts the
// account's currency, and the rate must be available (it is never guessed).
func (s *CertificateService) resolvePayout(ctx context.Context, cert *certificate.Certificate) (*payout, error) {
	if !cert.PaysOutInterest() || s.transactionService == nil {
		return nil, nil
	}
	p := &payout{accountID: *cert.PayoutAccountId, certCurrency: cert.CurrencyCode(), accountCurrency: cert.CurrencyCode()}
	if s.accountRepository == nil {
		return p, nil
	}
	acc, err := s.accountRepository.FindByIdAndUserId(ctx, p.accountID, cert.UserId)
	if err != nil {
		if isNotFound(err) {
			return nil, ErrPayoutAccountNotFound
		}
		return nil, err
	}
	if acc.Type == account.AccountTypeCreditCard {
		return nil, ErrCreditCardPayoutAccount
	}
	p.accountCurrency = money.NormalizeCurrency(acc.Currency, money.CurrencyDOP)
	if !money.IsSupportedCurrency(p.accountCurrency) || !money.IsSupportedCurrency(p.certCurrency) {
		return nil, ErrUnsupportedCurrency
	}
	if p.accountCurrency != p.certCurrency {
		rate, err := s.payoutRate(ctx)
		if err != nil {
			return nil, err
		}
		p.rate = rate
	}
	return p, nil
}

// payoutRate is the live USD->DOP rate, with no fallback.
func (s *CertificateService) payoutRate(ctx context.Context) (money.Amount, error) {
	if s.usdToDopRateFn == nil {
		return money.Zero, errPayoutRateUnavailable
	}
	rate, err := s.usdToDopRateFn(ctx)
	if err != nil || !rate.IsPositive() {
		return money.Zero, errPayoutRateUnavailable
	}
	return rate, nil
}

// processPendingPayments records the interest payments due up to now on the
// user's active certificates and marks the ones past maturity as matured.
// The interest of a certificate that pays it out is credited to its payout
// account (converted to the account's currency when needed).
//
// A certificate whose payout cannot be made (payout account gone, rate needed
// but unavailable) gets no new payments until it can: the problem is logged
// and returned per certificate id (shown as payout_error) instead of being
// swallowed, and the payments are recorded on a later read. A failure to
// write the payment or its transaction is returned, so the request fails and
// its transaction rolls back (no payment without its income, nor the reverse).
func (s *CertificateService) processPendingPayments(ctx context.Context, userId string) (map[string]string, error) {
	certificates, err := s.repository.FindActiveByUser(ctx, userId)
	if err != nil {
		return nil, err
	}

	// The last payment of every active certificate, in one query.
	var activeIds []string
	for _, cert := range certificates {
		if cert.Status == certificate.StatusActive {
			activeIds = append(activeIds, cert.Id)
		}
	}
	lastPayments, err := s.repository.FindLastPayments(ctx, activeIds, userId)
	if err != nil {
		return nil, err
	}

	now := time.Now()
	calculator := &PaymentCalculator{}
	payoutErrors := make(map[string]string)

	for _, cert := range certificates {
		if cert.Status != certificate.StatusActive {
			continue
		}

		lastPayment := lastPayments[cert.Id]

		var startDate time.Time
		if lastPayment != nil {
			startDate = lastPayment.PaymentDate
		} else {
			startDate = cert.CreatedAt
		}

		// The payout is resolved lazily, once, when a payment is due.
		var target *payout
		resolved := false

		for {
			nextPaymentDate := s.calculateNextPaymentDate(startDate, cert.CutDay)

			if nextPaymentDate.After(now) {
				break
			}
			// Defensive: a date that does not advance would record payments
			// forever inside the request.
			if !nextPaymentDate.After(startDate) {
				log.Error().Str("certificate_id", cert.Id).Time("from", startDate).Int("cut_day", cert.CutDay).
					Msg("certificate next payment date does not advance; stopping")
				break
			}

			if s.afterMaturity(nextPaymentDate, cert.MaturityDate) {
				_ = s.repository.UpdateStatus(ctx, cert.Id, userId, certificate.StatusMatured)
				break
			}

			if !resolved {
				resolved = true
				target, err = s.resolvePayout(ctx, cert)
				if err != nil {
					log.Error().Err(err).Str("certificate_id", cert.Id).Str("user_id", userId).
						Msg("certificate interest payout failed; payments left pending")
					payoutErrors[cert.Id] = err.Error()
					break
				}
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
				return nil, fmt.Errorf("saving payment of certificate %s: %w", cert.Id, err)
			}

			if target != nil {
				if err := s.creditInterest(ctx, cert, target, result.NetInterest, periodStart, periodEnd, nextPaymentDate, userId); err != nil {
					return nil, fmt.Errorf("crediting interest of certificate %s: %w", cert.Id, err)
				}
			}

			lastPayment = payment
			startDate = nextPaymentDate
		}
	}

	return payoutErrors, nil
}

// creditInterest records the net interest of one payment as income on the
// payout account, in the account's currency.
func (s *CertificateService) creditInterest(ctx context.Context, cert *certificate.Certificate, target *payout, net money.Amount, periodStart, periodEnd, paidAt time.Time, userId string) error {
	if !net.IsPositive() {
		return nil
	}
	start, end := periodStart.Format("2006-01-02"), periodEnd.Format("2006-01-02")
	name := i18n.T(ctx, i18n.CertificateInterestName, cert.Bank)
	description := i18n.T(ctx, i18n.CertificateInterestDescription, start, end)
	if target.accountCurrency != target.certCurrency {
		description = i18n.T(ctx, i18n.CertificateInterestFXDesc, start, end, net.StringFixed(2), target.certCurrency, target.accountCurrency, target.rate.StringFixed(4))
	}
	return s.transactionService.CreateTransaction(ctx, name, description, target.amount(net), "income", target.accountID, userId, "", "", target.accountCurrency, paidAt)
}

// GetEffectiveCapital returns the capital interest is computed on (the
// certificate's current value, see certificate.CurrentValue) and the last
// payment of a compound certificate. ctx must be the caller's context: inside
// an HTTP request it carries the RLS transaction, and querying with a
// detached context would need a second pooled connection while the request
// holds one (pool deadlock under load).
func (s *CertificateService) GetEffectiveCapital(ctx context.Context, cert *certificate.Certificate) (money.Amount, *certificate.CertificatePayment) {
	if cert.InterestType == certificate.InterestTypeSimple {
		return cert.BaseCapital, nil
	}

	lastPayment, err := s.repository.FindLastPayment(ctx, cert.Id, cert.UserId)
	if err != nil {
		return cert.BaseCapital, nil
	}

	return effectiveCapitalWith(cert, lastPayment)
}

// effectiveCapitalWith is GetEffectiveCapital given the certificate's last
// payment (nil when it has none).
func effectiveCapitalWith(cert *certificate.Certificate, lastPayment *certificate.CertificatePayment) (money.Amount, *certificate.CertificatePayment) {
	if cert.InterestType == certificate.InterestTypeSimple || lastPayment == nil {
		return cert.BaseCapital, nil
	}
	return cert.CurrentValue(lastPayment), lastPayment
}

func (s *CertificateService) getEffectiveCapitalForPayment(cert *certificate.Certificate, lastPayment *certificate.CertificatePayment) money.Amount {
	return cert.CurrentValue(lastPayment)
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

// calculateNextPaymentDate returns the first cut day after from's calendar
// day (from's month if its day is before the cut day, else the next month),
// clamped to the month's last day, at 12:00 UTC: the payment and its interest
// transaction land on the cut day in the app time zone (at 00:00 UTC they
// were the previous local evening).
// calculateNextPaymentDate returns the first cut date strictly after the
// calendar day of from. The cut day is clamped to the length of each month
// (a cut day of 31 falls on Sep 30 and Feb 28), and the comparison uses the
// clamped day: comparing with the raw cut day returned from itself for a
// payment on the clamped day (Sep 30 with cut day 31), so the payment loop
// never advanced.
func (s *CertificateService) calculateNextPaymentDate(from time.Time, cutDay int) time.Time {
	year, month, fromDay := s.calendarDay(from).Date()

	if fromDay >= clampDay(year, month, cutDay) {
		month++
		if month > 12 {
			month = 1
			year++
		}
	}

	return apptime.NoonUTC(year, month, clampDay(year, month, cutDay))
}

// clampDay is cutDay, or the last day of the month when the month is shorter.
func clampDay(year int, month time.Month, cutDay int) int {
	if daysInMonth := apptime.DaysIn(year, month); cutDay > daysInMonth {
		return daysInMonth
	}
	return cutDay
}

func (s *CertificateService) GetProjectedPayment(cert *certificate.Certificate, capital money.Amount, calculator *PaymentCalculator) *dto.ProjectedPaymentResponse {
	result := calculator.CalculateMonthlyPayment(capital, cert.CurrentInterestRate, cert.CurrentTaxRate)
	return &dto.ProjectedPaymentResponse{
		GrossInterest: result.GrossInterest,
		TaxWithheld:   result.TaxWithheld,
		NetInterest:   result.NetInterest,
	}
}

// summaryRate is the USD->DOP rate of the summary totals, falling back to
// money.FallbackUsdToDopRate like the dashboard.
func (s *CertificateService) summaryRate(ctx context.Context) money.Amount {
	if s.usdToDopRateFn != nil {
		if rate, err := s.usdToDopRateFn(ctx); err == nil && rate.IsPositive() {
			return rate
		}
	}
	return money.FallbackUsdToDopRate
}

// GetSummary totals the user's certificates in DOP (USD converted at the
// USD->DOP rate). TotalCapital and PortfolioValue cover only active
// certificates: a matured or cancelled one returned its capital to the user.
// PortfolioValue is what the active ones are worth now (capital plus the
// interest they capitalized, see certificate.CurrentValue): interest paid out
// is already in the payout account. The interest totals are every payment
// ever made (what the certificates earned).
func (s *CertificateService) GetSummary(ctx context.Context, userId string) (*dto.CertificateSummaryResponse, error) {
	certificates, err := s.repository.FindAll(ctx, userId)
	if err != nil {
		return nil, err
	}

	payments, err := s.repository.FindAllPayments(ctx, userId)
	if err != nil {
		return nil, err
	}

	rate := s.summaryRate(ctx)
	toDOP := func(amount money.Amount, currency string) money.Amount {
		dop, _ := money.ToDOP(amount, currency, rate)
		return dop
	}

	var totalCapital, totalGross, totalTax, totalNet, portfolio money.Amount
	activeCount := 0
	currencyOf := make(map[string]string, len(certificates))
	latest := certificate.LatestPayments(payments)

	for _, cert := range certificates {
		currencyOf[cert.Id] = cert.CurrencyCode()
		if cert.IsActive() {
			totalCapital = totalCapital.Add(toDOP(cert.BaseCapital, cert.CurrencyCode()))
			portfolio = portfolio.Add(toDOP(cert.CurrentValue(latest[cert.Id]), cert.CurrencyCode()))
			activeCount++
		}
	}

	for _, p := range payments {
		currency, ok := currencyOf[p.CertificateId]
		if !ok {
			currency = money.CurrencyDOP
		}
		totalGross = totalGross.Add(toDOP(p.GrossInterest, currency))
		totalTax = totalTax.Add(toDOP(p.TaxWithheld, currency))
		totalNet = totalNet.Add(toDOP(p.NetInterest, currency))
	}

	return &dto.CertificateSummaryResponse{
		TotalCapital:       totalCapital.RoundCents(),
		TotalGrossInterest: totalGross.RoundCents(),
		TotalTaxWithheld:   totalTax.RoundCents(),
		TotalNetInterest:   totalNet.RoundCents(),
		PortfolioValue:     portfolio.RoundCents(),
		ActiveCertificates: activeCount,
	}, nil
}
