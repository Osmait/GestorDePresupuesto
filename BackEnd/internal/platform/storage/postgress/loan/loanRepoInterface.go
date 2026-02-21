package postgress

import (
	"context"

	"github.com/osmait/gestorDePresupuesto/internal/domain/loan"
)

type LoanRepositoryInterface interface {
	SaveLoanWithInstallments(ctx context.Context, entity *loan.Loan, installments []*loan.Installment) error
	FindAllByUser(ctx context.Context, userId string) ([]*loan.Loan, error)
	FindById(ctx context.Context, id string, userId string) (*loan.Loan, error)
	FindInstallmentsByLoan(ctx context.Context, loanId string) ([]*loan.Installment, error)
	FindPaymentsByLoan(ctx context.Context, loanId string) ([]*loan.Payment, error)
	SavePayment(ctx context.Context, payment *loan.Payment) error
	UpdateLoanTotals(ctx context.Context, entity *loan.Loan) error
	BulkUpdateInstallments(ctx context.Context, installments []*loan.Installment) error
	UpdateLoanStatus(ctx context.Context, loanId string, userId string, status loan.LoanStatus) error
}
