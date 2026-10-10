package postgress

import (
	"context"

	"github.com/osmait/gestorDePresupuesto/internal/domain/loan"
)

// LoanRepositoryInterface persists loans with their installments and payments.
// Every method is scoped to the owning user; loans of other users are reported
// as not found.
type LoanRepositoryInterface interface {
	SaveLoanWithInstallments(ctx context.Context, entity *loan.Loan, installments []*loan.Installment) error
	FindAllByUser(ctx context.Context, userId string) ([]*loan.Loan, error)
	FindById(ctx context.Context, id string, userId string) (*loan.Loan, error)
	FindByIdForUpdate(ctx context.Context, id string, userId string) (*loan.Loan, error)
	FindInstallmentsByLoan(ctx context.Context, loanId string, userId string) ([]*loan.Installment, error)
	FindPaymentsByLoan(ctx context.Context, loanId string, userId string) ([]*loan.Payment, error)
	SavePayment(ctx context.Context, payment *loan.Payment, userId string) error
	UpdateLoanTotals(ctx context.Context, entity *loan.Loan) error
	BulkUpdateInstallments(ctx context.Context, installments []*loan.Installment, userId string) error
	UpdateLoanStatus(ctx context.Context, loanId string, userId string, status loan.LoanStatus) error
}
