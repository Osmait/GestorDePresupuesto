package loan

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/osmait/gestorDePresupuesto/internal/domain/loan"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
	loanRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/loan"
	"github.com/osmait/gestorDePresupuesto/internal/services/errorhttp"
)

type statusLoanRepo struct {
	loanRepo.LoanRepositoryInterface
	loan    *loan.Loan
	updates []loan.LoanStatus
}

func (r *statusLoanRepo) FindByIdForUpdate(context.Context, string, string) (*loan.Loan, error) {
	return r.loan, nil
}

func (r *statusLoanRepo) UpdateLoanStatus(_ context.Context, _ string, _ string, status loan.LoanStatus) error {
	r.updates = append(r.updates, status)
	r.loan.Status = status
	return nil
}

// Only active <-> defaulted is a manual change: cancelling must go through
// CancelLoan (which refunds once) and paid is set by the settling payment.
func TestUpdateStatus_Transitions(t *testing.T) {
	t.Parallel()
	cases := []struct {
		from, to loan.LoanStatus
		allowed  bool
	}{
		{loan.LoanStatusActive, loan.LoanStatusDefaulted, true},
		{loan.LoanStatusDefaulted, loan.LoanStatusActive, true},
		{loan.LoanStatusActive, loan.LoanStatusActive, true},
		{loan.LoanStatusCancelled, loan.LoanStatusActive, false},
		{loan.LoanStatusActive, loan.LoanStatusCancelled, false},
		{loan.LoanStatusActive, loan.LoanStatusPaid, false},
		{loan.LoanStatusPaid, loan.LoanStatusActive, false},
		{loan.LoanStatusDefaulted, loan.LoanStatusCancelled, false},
	}
	for _, c := range cases {
		t.Run(string(c.from)+"->"+string(c.to), func(t *testing.T) {
			t.Parallel()
			repo := &statusLoanRepo{loan: &loan.Loan{Id: "l1", Status: c.from, PrincipalAmount: money.FromInt(1000)}}
			svc := NewLoanService(repo, &recordingTransactions{}, stubAccounts{}, &memoryCategories{})

			err := svc.UpdateStatus(context.Background(), "l1", "user-1", c.to)
			if !c.allowed {
				require.Error(t, err)
				assert.True(t, errors.Is(err, errorhttp.ErrBadRequest), "want bad request, got %v", err)
				assert.Empty(t, repo.updates)
				assert.Equal(t, c.from, repo.loan.Status)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, c.to, repo.loan.Status)
		})
	}
}

// Cancelling, reactivating and cancelling again used to refund twice.
func TestCancelLoan_CannotBeReactivatedForASecondRefund(t *testing.T) {
	t.Parallel()
	repo := &statusLoanRepo{loan: &loan.Loan{Id: "l1", Status: loan.LoanStatusActive, PrincipalAmount: money.FromInt(1000), SourceAccountId: "acc-1"}}
	txs := &recordingTransactions{}
	svc := NewLoanService(repo, txs, stubAccounts{}, &memoryCategories{})

	require.NoError(t, svc.CancelLoan(context.Background(), "l1", "user-1"))
	require.Error(t, svc.UpdateStatus(context.Background(), "l1", "user-1", loan.LoanStatusActive))
	require.Error(t, svc.CancelLoan(context.Background(), "l1", "user-1"))
	assert.Len(t, txs.calls, 1, "the pending principal is refunded once")
}
