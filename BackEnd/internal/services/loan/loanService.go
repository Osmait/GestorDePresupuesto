package loan

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	accountDomain "github.com/osmait/gestorDePresupuesto/internal/domain/account"
	categoryDomain "github.com/osmait/gestorDePresupuesto/internal/domain/category"
	"github.com/osmait/gestorDePresupuesto/internal/domain/loan"
	dto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/loan"
	loanRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/loan"
	"github.com/osmait/gestorDePresupuesto/internal/services/errorhttp"
	"github.com/segmentio/ksuid"
)

type TransactionServiceInterface interface {
	CreateTransaction(ctx context.Context, name, description string, amount float64, typeTransaction string, accountId string, userId string, categoryId string, budgetId string, currency string, createdAt time.Time) error
}

type AccountRepositoryInterface interface {
	FindByIdAndUserId(ctx context.Context, id string, userId string) (*accountDomain.Account, error)
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
}

func NewLoanService(repository loanRepo.LoanRepositoryInterface, transactionService TransactionServiceInterface, accountRepository AccountRepositoryInterface, categoryRepository CategoryRepositoryInterface) *LoanService {
	return &LoanService{
		repository:         repository,
		transactionService: transactionService,
		accountRepository:  accountRepository,
		categoryRepository: categoryRepository,
	}
}

func (s *LoanService) CreateLoan(ctx context.Context, req *dto.CreateLoanRequest, userId string) (*dto.LoanResponse, error) {
	if err := req.Validate(); err != nil {
		return nil, err
	}

	_, err := s.accountRepository.FindByIdAndUserId(ctx, req.SourceAccountId, userId)
	if err != nil {
		return nil, errors.New("source account not found")
	}

	id, _ := ksuid.NewRandom()

	principal := round2(req.PrincipalAmount)
	totalInterest := 0.0
	if req.InterestMode == string(loan.InterestModeFixedTotal) {
		totalInterest = round2(principal * (req.AnnualRate / 100) * (float64(req.TermMonths) / 12))
	}
	totalAmount := round2(principal + totalInterest)
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
		StartDate:       req.ParsedStartDate(),
		SourceAccountId: req.SourceAccountId,
		Notes:           req.Notes,
		TotalInterest:   totalInterest,
		TotalAmount:     totalAmount,
		PaidPrincipal:   0,
		PaidInterest:    0,
		Status:          loan.LoanStatusActive,
		CreatedAt:       now,
		UpdatedAt:       now,
	}

	installments := buildInstallments(entity)
	if err := s.repository.SaveLoanWithInstallments(ctx, entity, installments); err != nil {
		return nil, err
	}

	if s.transactionService != nil {
		categoryId, catErr := s.ensureSystemCategory(ctx, userId, "Prestamos otorgados", "💸", "#0ea5e9")
		if catErr != nil {
			return nil, catErr
		}

		txErr := s.transactionService.CreateTransaction(
			ctx,
			"Loan to "+entity.BorrowerName,
			"Loan disbursement",
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
		return nil, err
	}

	installments, err := s.repository.FindInstallmentsByLoan(ctx, id)
	if err != nil {
		return nil, err
	}

	payments, err := s.repository.FindPaymentsByLoan(ctx, id)
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
		return nil, err
	}

	entity, err := s.repository.FindById(ctx, loanId, userId)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, errors.New("loan not found")
		}
		return nil, err
	}

	if entity.Status != loan.LoanStatusActive {
		return nil, errors.New("loan is not active")
	}

	_, err = s.accountRepository.FindByIdAndUserId(ctx, req.DestinationAccountId, userId)
	if err != nil {
		return nil, errors.New("destination account not found")
	}

	pending := entity.TotalAmount - (entity.PaidPrincipal + entity.PaidInterest)
	if pending <= 0 {
		return nil, errors.New("loan already paid")
	}

	paymentAmount := req.Amount
	if paymentAmount > pending {
		return nil, fmt.Errorf("%w: payment amount cannot be greater than pending amount", errorhttp.ErrBadRequest)
	}

	remainingInterest := entity.TotalInterest - entity.PaidInterest
	if remainingInterest < 0 {
		remainingInterest = 0
	}

	interestComponent := math.Min(paymentAmount, remainingInterest)
	principalComponent := paymentAmount - interestComponent

	paymentId, _ := ksuid.NewRandom()
	payment := &loan.Payment{
		Id:                   paymentId.String(),
		LoanId:               entity.Id,
		DestinationAccountId: req.DestinationAccountId,
		Amount:               round2(paymentAmount),
		PrincipalComponent:   round2(principalComponent),
		InterestComponent:    round2(interestComponent),
		PaymentDate:          req.ParsedPaymentDate(),
		Notes:                req.Notes,
		CreatedAt:            time.Now(),
	}

	if err := s.repository.SavePayment(ctx, payment); err != nil {
		return nil, err
	}

	if s.transactionService != nil {
		if payment.PrincipalComponent > 0 {
			principalCategoryId, catErr := s.ensureSystemCategory(ctx, userId, "Cobro de prestamos", "💰", "#22c55e")
			if catErr != nil {
				return nil, catErr
			}

			txErr := s.transactionService.CreateTransaction(
				ctx,
				"Loan principal - "+entity.BorrowerName,
				"Principal collection for loan",
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

		if payment.InterestComponent > 0 {
			interestCategoryId, catErr := s.ensureSystemCategory(ctx, userId, "Intereses cobrados", "📈", "#16a34a")
			if catErr != nil {
				return nil, catErr
			}

			txErr := s.transactionService.CreateTransaction(
				ctx,
				"Loan interest - "+entity.BorrowerName,
				"Interest income from loan",
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

	entity.PaidInterest = round2(entity.PaidInterest + payment.InterestComponent)
	entity.PaidPrincipal = round2(entity.PaidPrincipal + payment.PrincipalComponent)
	if entity.PaidInterest+entity.PaidPrincipal >= entity.TotalAmount {
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

func (s *LoanService) UpdateStatus(ctx context.Context, loanId string, userId string, status loan.LoanStatus) error {
	return s.repository.UpdateLoanStatus(ctx, loanId, userId, status)
}

func (s *LoanService) GetSummary(ctx context.Context, userId string) (*dto.LoanSummaryResponse, error) {
	loans, err := s.repository.FindAllByUser(ctx, userId)
	if err != nil {
		return nil, err
	}

	now := time.Now()
	summary := &dto.LoanSummaryResponse{}

	for _, item := range loans {
		summary.TotalPrincipal += item.PrincipalAmount
		summary.TotalCollected += item.PaidPrincipal + item.PaidInterest
		summary.TotalInterestEarned += item.PaidInterest

		pending := item.TotalAmount - (item.PaidPrincipal + item.PaidInterest)
		if pending > 0 {
			summary.TotalPending += pending
		}

		if item.Status == loan.LoanStatusActive {
			summary.ActiveLoans++

			installments, _ := s.repository.FindInstallmentsByLoan(ctx, item.Id)
			for _, installment := range installments {
				if installment.Status != loan.InstallmentStatusPaid && installment.DueDate.Before(now) {
					summary.OverdueLoans++
					break
				}
			}
		}
	}

	summary.TotalPrincipal = round2(summary.TotalPrincipal)
	summary.TotalCollected = round2(summary.TotalCollected)
	summary.TotalPending = round2(summary.TotalPending)
	summary.TotalInterestEarned = round2(summary.TotalInterestEarned)

	return summary, nil
}

func (s *LoanService) syncInstallments(ctx context.Context, entity *loan.Loan) error {
	installments, err := s.repository.FindInstallmentsByLoan(ctx, entity.Id)
	if err != nil {
		return err
	}

	remaining := round2(entity.PaidPrincipal + entity.PaidInterest)
	now := time.Now()
	for _, installment := range installments {
		installment.PaidAmount = 0
		installment.PaidAt = nil

		if remaining <= 0 {
			if installment.DueDate.Before(now) {
				installment.Status = loan.InstallmentStatusOverdue
			} else {
				installment.Status = loan.InstallmentStatusPending
			}
			installment.UpdatedAt = now
			continue
		}

		if remaining >= installment.ExpectedAmount {
			installment.PaidAmount = round2(installment.ExpectedAmount)
			installment.Status = loan.InstallmentStatusPaid
			paidAt := now
			installment.PaidAt = &paidAt
			remaining = round2(remaining - installment.ExpectedAmount)
		} else {
			installment.PaidAmount = round2(remaining)
			installment.Status = loan.InstallmentStatusPartial
			paidAt := now
			installment.PaidAt = &paidAt
			remaining = 0
		}
		installment.UpdatedAt = now
	}

	return s.repository.BulkUpdateInstallments(ctx, installments)
}

func buildInstallments(entity *loan.Loan) []*loan.Installment {
	installments := make([]*loan.Installment, 0, entity.TermMonths)
	baseAmount := round2(entity.TotalAmount / float64(entity.TermMonths))
	running := 0.0
	now := time.Now()

	for i := 1; i <= entity.TermMonths; i++ {
		installmentId, _ := ksuid.NewRandom()
		dueDate := entity.StartDate.AddDate(0, i, 0)
		expected := baseAmount
		if i == entity.TermMonths {
			expected = round2(entity.TotalAmount - running)
		}
		running = round2(running + expected)

		installments = append(installments, &loan.Installment{
			Id:                installmentId.String(),
			LoanId:            entity.Id,
			InstallmentNumber: i,
			DueDate:           dueDate,
			ExpectedAmount:    expected,
			PaidAmount:        0,
			Status:            loan.InstallmentStatusPending,
			CreatedAt:         now,
			UpdatedAt:         now,
		})
	}

	return installments
}

func round2(value float64) float64 {
	return math.Round(value*100) / 100
}

func (s *LoanService) ensureSystemCategory(ctx context.Context, userId string, name string, icon string, color string) (string, error) {
	categories, err := s.categoryRepository.FindAll(ctx, userId)
	if err != nil {
		return "", err
	}

	for _, category := range categories {
		if strings.EqualFold(strings.TrimSpace(category.Name), strings.TrimSpace(name)) {
			return category.Id, nil
		}
	}

	id, _ := ksuid.NewRandom()
	newCategory := categoryDomain.NewCategory(id.String(), name, icon, color)
	newCategory.UserId = userId

	if err := s.categoryRepository.Save(ctx, newCategory); err != nil {
		return "", err
	}

	return newCategory.Id, nil
}
