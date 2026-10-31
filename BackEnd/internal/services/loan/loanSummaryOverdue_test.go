package loan

import (
	"context"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/osmait/gestorDePresupuesto/internal/domain/loan"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
	loanRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/loan"
)

type summaryLoanRepo struct {
	loanRepo.LoanRepositoryInterface
	loans        []*loan.Loan
	installments map[string][]*loan.Installment
	batchCalls   [][]string
}

func (r *summaryLoanRepo) FindAllByUser(context.Context, string) ([]*loan.Loan, error) {
	return r.loans, nil
}

func (r *summaryLoanRepo) FindInstallmentsByLoans(_ context.Context, loanIds []string, _ string) (map[string][]*loan.Installment, error) {
	r.batchCalls = append(r.batchCalls, loanIds)
	out := make(map[string][]*loan.Installment)
	for _, id := range loanIds {
		if items, ok := r.installments[id]; ok {
			out[id] = items
		}
	}
	return out, nil
}

// OverdueLoans counts the active loans with an unpaid installment due before
// today; the installments of every active loan are read in one call.
func TestGetSummary_OverdueLoansInOneLookup(t *testing.T) {
	t.Parallel()
	past := time.Now().AddDate(0, 0, -10)
	future := time.Now().AddDate(0, 0, 10)
	installment := func(status loan.InstallmentStatus, due time.Time) *loan.Installment {
		return &loan.Installment{Status: status, DueDate: due}
	}
	active := func(id string) *loan.Loan {
		return &loan.Loan{Id: id, Currency: "DOP", Status: loan.LoanStatusActive, PrincipalAmount: money.FromInt(100), TotalAmount: money.FromInt(100)}
	}
	defaulted := &loan.Loan{Id: "defaulted", Currency: "DOP", Status: loan.LoanStatusDefaulted, PrincipalAmount: money.FromInt(100), TotalAmount: money.FromInt(100)}

	repo := &summaryLoanRepo{
		loans: []*loan.Loan{active("overdue"), active("paid-past"), defaulted, active("future"), active("partial"), active("none")},
		installments: map[string][]*loan.Installment{
			"overdue":   {installment(loan.InstallmentStatusPaid, past), installment(loan.InstallmentStatusPending, past)},
			"paid-past": {installment(loan.InstallmentStatusPaid, past), installment(loan.InstallmentStatusPending, future)},
			"defaulted": {installment(loan.InstallmentStatusPending, past)},
			"future":    {installment(loan.InstallmentStatusPending, future)},
			"partial":   {installment(loan.InstallmentStatusPartial, past), installment(loan.InstallmentStatusPending, past)},
		},
	}
	svc := NewLoanService(repo, &recordingTransactions{}, stubAccounts{}, &memoryCategories{}, WithLocation(time.UTC))

	summary, err := svc.GetSummary(context.Background(), "user-1")
	require.NoError(t, err)
	assert.Equal(t, 2, summary.OverdueLoans)
	assert.Equal(t, 5, summary.ActiveLoans)
	require.Len(t, repo.batchCalls, 1)
	assert.Equal(t, []string{"overdue", "paid-past", "future", "partial", "none"}, repo.batchCalls[0])
}

func TestGetSummary_NoActiveLoansSkipsInstallments(t *testing.T) {
	t.Parallel()
	repo := &summaryLoanRepo{loans: []*loan.Loan{{Id: "paid", Currency: "DOP", Status: loan.LoanStatusPaid}}}
	svc := NewLoanService(repo, &recordingTransactions{}, stubAccounts{}, &memoryCategories{})

	summary, err := svc.GetSummary(context.Background(), "user-1")
	require.NoError(t, err)
	assert.Zero(t, summary.OverdueLoans)
	assert.Empty(t, repo.batchCalls)
}
