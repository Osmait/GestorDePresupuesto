package loan

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	accountDomain "github.com/osmait/gestorDePresupuesto/internal/domain/account"
	categoryDomain "github.com/osmait/gestorDePresupuesto/internal/domain/category"
	"github.com/osmait/gestorDePresupuesto/internal/domain/loan"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
	"github.com/osmait/gestorDePresupuesto/internal/platform/apptime"
	dto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/loan"
	"github.com/osmait/gestorDePresupuesto/internal/platform/i18n"
	loanRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/loan"
	"github.com/osmait/gestorDePresupuesto/internal/services/errorhttp"
	"github.com/osmait/gestorDePresupuesto/internal/services/funds"
	"github.com/osmait/gestorDePresupuesto/internal/services/systemcategory"
	"github.com/segmentio/ksuid"
)

var (
	// ErrLoanNotFound is returned when a loan does not exist or belongs to another user.
	ErrLoanNotFound = fmt.Errorf("%w: loan not found", errorhttp.ErrNotFound)
)

func isNotFound(err error) bool {
	return errors.Is(err, sql.ErrNoRows) || errors.Is(err, errorhttp.ErrNotFound)
}

type TransactionServiceInterface interface {
	CreateTransaction(ctx context.Context, name, description string, amount money.Amount, typeTransaction string, accountId string, userId string, categoryId string, budgetId string, currency string, createdAt time.Time) error
}

type AccountRepositoryInterface interface {
	FindByIdAndUserId(ctx context.Context, id string, userId string) (*accountDomain.Account, error)
	// FindByIdAndUserIdForUpdate locks the source account of a disbursement
	// for the request transaction; Balance feeds the overdraft check.
	FindByIdAndUserIdForUpdate(ctx context.Context, id string, userId string) (*accountDomain.Account, error)
	Balance(ctx context.Context, id string, userId string) (money.Amount, error)
}

type CategoryRepositoryInterface interface {
	FindAll(ctx context.Context, userId string) ([]*categoryDomain.Category, error)
	Save(ctx context.Context, category *categoryDomain.Category) error
}

type LoanService struct {
	repository         loanRepo.LoanRepositoryInterface
	transactionService TransactionServiceInterface
	accountRepository  AccountRepositoryInterface
	categoryRepository CategoryRepositoryInterface
	loc                *time.Location
}

// Option configures a LoanService.
type Option func(*LoanService)

// WithLocation sets the app time zone that "today" and overdue installments
// are evaluated in (default apptime.Default()).
func WithLocation(loc *time.Location) Option {
	return func(s *LoanService) {
		if loc != nil {
			s.loc = loc
		}
	}
}

func NewLoanService(repository loanRepo.LoanRepositoryInterface, transactionService TransactionServiceInterface, accountRepository AccountRepositoryInterface, categoryRepository CategoryRepositoryInterface, opts ...Option) *LoanService {
	s := &LoanService{
		repository:         repository,
		transactionService: transactionService,
		accountRepository:  accountRepository,
		categoryRepository: categoryRepository,
		loc:                apptime.Default(),
	}
	for _, opt := range opts {
		opt(s)
	}
	return s
}

// isOverdue reports whether an installment due on due's calendar day (a DATE:
// 00:00 or 12:00 UTC of the day) is past due at now: its due day is before
// today in the app time zone. It is not overdue on the due day itself.
func isOverdue(due, now time.Time, loc *time.Location) bool {
	y, m, d := due.UTC().Date()
	return apptime.NoonUTC(y, m, d).Before(apptime.TodayNoonUTC(now, loc))
}

func (s *LoanService) CreateLoan(ctx context.Context, req *dto.CreateLoanRequest, userId string) (*dto.LoanResponse, error) {
	if err := req.Validate(); err != nil {
		return nil, fmt.Errorf("%w: %s", errorhttp.ErrBadRequest, err.Error())
	}

	// Lock the source account until the request transaction ends so the funds
	// check below cannot interleave with another debit of the same account.
	sourceAccount, err := s.accountRepository.FindByIdAndUserIdForUpdate(ctx, req.SourceAccountId, userId)
	if err != nil {
		if isNotFound(err) {
			return nil, fmt.Errorf("%w: source account not found", errorhttp.ErrBadRequest)
		}
		return nil, err
	}

	id, _ := ksuid.NewRandom()

	principal := req.PrincipalAmount.RoundCents()

	// No overdrafts: the disbursement leaves the source account, which must
	// hold the principal. Balances are only comparable in the same currency;
	// a loan in another currency than its source account is not checked.
	if s.transactionService != nil && sameCurrency(sourceAccount.Currency, req.Currency) {
		if err := funds.Require(ctx, s.accountRepository, sourceAccount, userId, principal); err != nil {
			return nil, err
		}
	}
	totalInterest := money.Zero
	if req.InterestMode == string(loan.InterestModeFixedTotal) {
		// principal * rate% * months/12, multiplied exactly and divided once,
		// then rounded half-even to cents.
		totalInterest = principal.Mul(req.AnnualRate).MulInt(int64(req.TermMonths)).DivInt(1200).RoundCents()
	}
	totalAmount := principal.Add(totalInterest)
	now := time.Now()

	entity := &loan.Loan{
		Id:              id.String(),
		UserId:          userId,
		BorrowerName:    req.BorrowerName,
		BorrowerContact: req.BorrowerContact,
		PrincipalAmount: principal,
		Currency:        req.Currency,
		InterestMode:    loan.InterestMode(req.InterestMode),
		AnnualRate:      req.AnnualRate,
		TermMonths:      req.TermMonths,
		StartDate:       req.ParsedStartDate(now, s.loc),
		SourceAccountId: req.SourceAccountId,
		Notes:           req.Notes,
		TotalInterest:   totalInterest,
		TotalAmount:     totalAmount,
		PaidPrincipal:   money.Zero,
		PaidInterest:    money.Zero,
		Status:          loan.LoanStatusActive,
		CreatedAt:       now,
		UpdatedAt:       now,
	}

	installments := buildInstallments(entity)
	if err := s.repository.SaveLoanWithInstallments(ctx, entity, installments); err != nil {
		return nil, err
	}

	if s.transactionService != nil {
		categoryId, catErr := s.ensureSystemCategory(ctx, userId, categoryDomain.SystemLoansGranted)
		if catErr != nil {
			return nil, catErr
		}

		txErr := s.transactionService.CreateTransaction(
			ctx,
			i18n.T(ctx, i18n.LoanDisbursementName, entity.BorrowerName),
			i18n.T(ctx, i18n.LoanDisbursementDescription),
			entity.PrincipalAmount,
			"loan_disbursement",
			entity.SourceAccountId,
			userId,
			categoryId,
			"",
			entity.Currency,
			entity.StartDate,
		)
		if txErr != nil {
			return nil, txErr
		}
	}

	response := dto.NewLoanResponse(entity)
	return &response, nil
}

// sameCurrency compares currency codes; an empty code is the default DOP.
func sameCurrency(a, b string) bool {
	norm := func(c string) string {
		if c = strings.ToUpper(strings.TrimSpace(c)); c == "" {
			return "DOP"
		}
		return c
	}
	return norm(a) == norm(b)
}

func (s *LoanService) FindAll(ctx context.Context, userId string) ([]dto.LoanResponse, error) {
	loans, err := s.repository.FindAllByUser(ctx, userId)
	if err != nil {
		return nil, err
	}

	responses := make([]dto.LoanResponse, 0, len(loans))
	for _, entity := range loans {
		responses = append(responses, dto.NewLoanResponse(entity))
	}

	return responses, nil
}

func (s *LoanService) FindById(ctx context.Context, id string, userId string) (*dto.LoanDetailsResponse, error) {
	entity, err := s.repository.FindById(ctx, id, userId)
	if err != nil {
		if isNotFound(err) {
			return nil, ErrLoanNotFound
		}
		return nil, err
	}

	installments, err := s.repository.FindInstallmentsByLoan(ctx, id, userId)
	if err != nil {
		return nil, err
	}

	payments, err := s.repository.FindPaymentsByLoan(ctx, id, userId)
	if err != nil {
		return nil, err
	}

	installmentResponses := make([]dto.LoanInstallmentResponse, 0, len(installments))
	for _, installment := range installments {
		installmentResponses = append(installmentResponses, dto.NewInstallmentResponse(installment))
	}

	paymentResponses := make([]dto.LoanPaymentResponse, 0, len(payments))
	for _, payment := range payments {
		paymentResponses = append(paymentResponses, dto.NewPaymentResponse(payment))
	}

	response := &dto.LoanDetailsResponse{
		Loan:         dto.NewLoanResponse(entity),
		Installments: installmentResponses,
		Payments:     paymentResponses,
	}

	return response, nil
}

func (s *LoanService) RegisterPayment(ctx context.Context, loanId string, userId string, req *dto.RegisterLoanPaymentRequest) (*dto.LoanPaymentResponse, error) {
	if err := req.Validate(); err != nil {
		return nil, fmt.Errorf("%w: %s", errorhttp.ErrBadRequest, err.Error())
	}

	// Lock the loan row for the rest of the request transaction: the paid
	// totals below are read-modify-write, and concurrent payments must
	// serialise on this lock instead of overwriting each other.
	entity, err := s.repository.FindByIdForUpdate(ctx, loanId, userId)
	if err != nil {
		if isNotFound(err) {
			return nil, ErrLoanNotFound
		}
		return nil, err
	}

	if entity.Status != loan.LoanStatusActive {
		return nil, fmt.Errorf("%w: loan is not active", errorhttp.ErrBadRequest)
	}

	_, err = s.accountRepository.FindByIdAndUserId(ctx, req.DestinationAccountId, userId)
	if err != nil {
		if isNotFound(err) {
			return nil, fmt.Errorf("%w: destination account not found", errorhttp.ErrBadRequest)
		}
		return nil, err
	}

	pending := entity.TotalAmount.Sub(entity.PaidPrincipal.Add(entity.PaidInterest))
	if !pending.IsPositive() {
		return nil, fmt.Errorf("%w: loan already paid", errorhttp.ErrBadRequest)
	}

	paymentAmount := req.Amount.RoundCents()
	if paymentAmount.GreaterThan(pending) {
		return nil, fmt.Errorf("%w: payment amount cannot be greater than pending amount", errorhttp.ErrBadRequest)
	}

	remainingInterest := money.Max(entity.TotalInterest.Sub(entity.PaidInterest), money.Zero)

	interestComponent := money.Min(paymentAmount, remainingInterest)
	principalComponent := paymentAmount.Sub(interestComponent)

	paymentId, _ := ksuid.NewRandom()
	payment := &loan.Payment{
		Id:                   paymentId.String(),
		LoanId:               entity.Id,
		DestinationAccountId: req.DestinationAccountId,
		Amount:               paymentAmount,
		PrincipalComponent:   principalComponent,
		InterestComponent:    interestComponent,
		PaymentDate:          req.ParsedPaymentDate(time.Now()),
		Notes:                req.Notes,
		CreatedAt:            time.Now(),
	}

	if err := s.repository.SavePayment(ctx, payment, userId); err != nil {
		return nil, err
	}

	if s.transactionService != nil {
		if payment.PrincipalComponent.IsPositive() {
			principalCategoryId, catErr := s.ensureSystemCategory(ctx, userId, categoryDomain.SystemLoanCollections)
			if catErr != nil {
				return nil, catErr
			}

			txErr := s.transactionService.CreateTransaction(
				ctx,
				i18n.T(ctx, i18n.LoanPrincipalName, entity.BorrowerName),
				i18n.T(ctx, i18n.LoanPrincipalDescription),
				payment.PrincipalComponent,
				"loan_collection",
				req.DestinationAccountId,
				userId,
				principalCategoryId,
				"",
				entity.Currency,
				payment.PaymentDate,
			)
			if txErr != nil {
				return nil, txErr
			}
		}

		if payment.InterestComponent.IsPositive() {
			interestCategoryId, catErr := s.ensureSystemCategory(ctx, userId, categoryDomain.SystemLoanInterest)
			if catErr != nil {
				return nil, catErr
			}

			txErr := s.transactionService.CreateTransaction(
				ctx,
				i18n.T(ctx, i18n.LoanInterestName, entity.BorrowerName),
				i18n.T(ctx, i18n.LoanInterestDescription),
				payment.InterestComponent,
				"income",
				req.DestinationAccountId,
				userId,
				interestCategoryId,
				"",
				entity.Currency,
				payment.PaymentDate,
			)
			if txErr != nil {
				return nil, txErr
			}
		}
	}

	entity.PaidInterest = entity.PaidInterest.Add(payment.InterestComponent)
	entity.PaidPrincipal = entity.PaidPrincipal.Add(payment.PrincipalComponent)
	if entity.PaidInterest.Add(entity.PaidPrincipal).GreaterThanOrEqual(entity.TotalAmount) {
		entity.Status = loan.LoanStatusPaid
	}
	entity.UpdatedAt = time.Now()

	if err := s.repository.UpdateLoanTotals(ctx, entity); err != nil {
		return nil, err
	}

	if err := s.syncInstallments(ctx, entity); err != nil {
		return nil, err
	}

	response := dto.NewPaymentResponse(payment)
	return &response, nil
}

func (s *LoanService) CancelLoan(ctx context.Context, loanId string, userId string) error {
	// Locked so a concurrent payment cannot change paid_principal between the
	// refund computation and the status change.
	entity, err := s.repository.FindByIdForUpdate(ctx, loanId, userId)
	if err != nil {
		if isNotFound(err) {
			return ErrLoanNotFound
		}
		return err
	}

	if entity.Status != loan.LoanStatusActive {
		return fmt.Errorf("%w: only active loans can be cancelled", errorhttp.ErrBadRequest)
	}

	remainingPrincipal := entity.PrincipalAmount.Sub(entity.PaidPrincipal).RoundCents()

	if remainingPrincipal.IsPositive() && s.transactionService != nil {
		categoryId, catErr := s.ensureSystemCategory(ctx, userId, categoryDomain.SystemLoanCancellation)
		if catErr != nil {
			return catErr
		}

		txErr := s.transactionService.CreateTransaction(
			ctx,
			i18n.T(ctx, i18n.LoanRefundName, entity.BorrowerName),
			i18n.T(ctx, i18n.LoanRefundDescription),
			remainingPrincipal,
			"loan_cancellation_refund",
			entity.SourceAccountId,
			userId,
			categoryId,
			"",
			entity.Currency,
			time.Now(),
		)
		if txErr != nil {
			return txErr
		}
	}

	return s.repository.UpdateLoanStatus(ctx, loanId, userId, loan.LoanStatusCancelled)
}

// UpdateStatus only moves a loan between active and defaulted. Paid is set by
// the payment that settles the loan and cancelled by CancelLoan, which also
// refunds the pending principal; allowing either here (or leaving cancelled)
// would skip or repeat that bookkeeping.
func (s *LoanService) UpdateStatus(ctx context.Context, loanId string, userId string, status loan.LoanStatus) error {
	entity, err := s.repository.FindByIdForUpdate(ctx, loanId, userId)
	if err != nil {
		if isNotFound(err) {
			return ErrLoanNotFound
		}
		return err
	}
	if entity.Status == status {
		return nil
	}
	allowed := (entity.Status == loan.LoanStatusActive && status == loan.LoanStatusDefaulted) ||
		(entity.Status == loan.LoanStatusDefaulted && status == loan.LoanStatusActive)
	if !allowed {
		return fmt.Errorf("%w: cannot change a %s loan to %s", errorhttp.ErrBadRequest, entity.Status, status)
	}
	if err := s.repository.UpdateLoanStatus(ctx, loanId, userId, status); err != nil {
		if isNotFound(err) {
			return ErrLoanNotFound
		}
		return err
	}
	return nil
}

func (s *LoanService) GetSummary(ctx context.Context, userId string) (*dto.LoanSummaryResponse, error) {
	loans, err := s.repository.FindAllByUser(ctx, userId)
	if err != nil {
		return nil, err
	}

	now := time.Now()
	summary := &dto.LoanSummaryResponse{}

	for _, item := range loans {
		summary.TotalPrincipal = summary.TotalPrincipal.Add(item.PrincipalAmount)
		summary.TotalCollected = summary.TotalCollected.Add(item.PaidPrincipal.Add(item.PaidInterest))
		summary.TotalInterestEarned = summary.TotalInterestEarned.Add(item.PaidInterest)

		pending := item.TotalAmount.Sub(item.PaidPrincipal.Add(item.PaidInterest))
		if pending.IsPositive() {
			summary.TotalPending = summary.TotalPending.Add(pending)
		}

		if item.Status == loan.LoanStatusActive {
			summary.ActiveLoans++

			installments, _ := s.repository.FindInstallmentsByLoan(ctx, item.Id, userId)
			for _, installment := range installments {
				if installment.Status != loan.InstallmentStatusPaid && isOverdue(installment.DueDate, now, s.loc) {
					summary.OverdueLoans++
					break
				}
			}
		}
	}

	summary.TotalPrincipal = summary.TotalPrincipal.RoundCents()
	summary.TotalCollected = summary.TotalCollected.RoundCents()
	summary.TotalPending = summary.TotalPending.RoundCents()
	summary.TotalInterestEarned = summary.TotalInterestEarned.RoundCents()

	return summary, nil
}

func (s *LoanService) syncInstallments(ctx context.Context, entity *loan.Loan) error {
	installments, err := s.repository.FindInstallmentsByLoan(ctx, entity.Id, entity.UserId)
	if err != nil {
		return err
	}

	remaining := entity.PaidPrincipal.Add(entity.PaidInterest)
	now := time.Now()
	for _, installment := range installments {
		installment.PaidAmount = money.Zero
		installment.PaidAt = nil

		if !remaining.IsPositive() {
			if isOverdue(installment.DueDate, now, s.loc) {
				installment.Status = loan.InstallmentStatusOverdue
			} else {
				installment.Status = loan.InstallmentStatusPending
			}
			installment.UpdatedAt = now
			continue
		}

		if remaining.GreaterThanOrEqual(installment.ExpectedAmount) {
			installment.PaidAmount = installment.ExpectedAmount
			installment.Status = loan.InstallmentStatusPaid
			paidAt := now
			installment.PaidAt = &paidAt
			remaining = remaining.Sub(installment.ExpectedAmount)
		} else {
			installment.PaidAmount = remaining
			installment.Status = loan.InstallmentStatusPartial
			paidAt := now
			installment.PaidAt = &paidAt
			remaining = money.Zero
		}
		installment.UpdatedAt = now
	}

	return s.repository.BulkUpdateInstallments(ctx, installments, entity.UserId)
}

func buildInstallments(entity *loan.Loan) []*loan.Installment {
	installments := make([]*loan.Installment, 0, entity.TermMonths)
	// Equal installments rounded half-even to cents; the last one absorbs the
	// rounding remainder so the schedule always sums exactly to TotalAmount.
	baseAmount := entity.TotalAmount.DivInt(int64(entity.TermMonths)).RoundCents()
	running := money.Zero
	now := time.Now()

	for i := 1; i <= entity.TermMonths; i++ {
		installmentId, _ := ksuid.NewRandom()
		// Same day of month as the start date, clamped to the month's last
		// day (Jan 31 -> Feb 28 -> Mar 31; AddDate would give Mar 3).
		dueDate := apptime.AddMonthsClamped(entity.StartDate, i)
		expected := baseAmount
		if i == entity.TermMonths {
			expected = entity.TotalAmount.Sub(running)
		}
		running = running.Add(expected)

		installments = append(installments, &loan.Installment{
			Id:                installmentId.String(),
			LoanId:            entity.Id,
			InstallmentNumber: i,
			DueDate:           dueDate,
			ExpectedAmount:    expected,
			PaidAmount:        money.Zero,
			Status:            loan.InstallmentStatusPending,
			CreatedAt:         now,
			UpdatedAt:         now,
		})
	}

	return installments
}

// ensureSystemCategory returns the id of the user's system category sys,
// found by its stable identity (never by the localized name).
func (s *LoanService) ensureSystemCategory(ctx context.Context, userId string, sys categoryDomain.System) (string, error) {
	return systemcategory.Ensure(ctx, s.categoryRepository, userId, sys)
}
