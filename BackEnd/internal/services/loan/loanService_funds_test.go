package loan

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
	dto "github.com/osmait/gestorDePresupuesto/internal/platform/dto/loan"
	apperrors "github.com/osmait/gestorDePresupuesto/internal/platform/errors"
	"github.com/osmait/gestorDePresupuesto/internal/services/errorhttp"
	"github.com/osmait/gestorDePresupuesto/internal/services/funds"
)

// spentAccounts is stubAccounts (1000 initial balance) with 900 already spent.
type spentAccounts struct{ stubAccounts }

func (spentAccounts) Balance(context.Context, string, string) (money.Amount, error) {
	return money.FromInt(-900), nil
}

func newLoanRequest(principal, currency string) *dto.CreateLoanRequest {
	return &dto.CreateLoanRequest{
		BorrowerName: "Ana", PrincipalAmount: money.MustParse(principal), InterestMode: "none",
		TermMonths: 2, SourceAccountId: "acc-1", Currency: currency,
	}
}

func TestCreateLoan_RejectsDisbursementAboveSourceBalance(t *testing.T) {
	txs := &recordingTransactions{}
	svc := NewLoanService(stubLoanRepo{}, txs, spentAccounts{}, &memoryCategories{})

	_, err := svc.CreateLoan(context.Background(), newLoanRequest("100.01", ""), "user-1")

	require.True(t, errors.Is(err, funds.ErrInsufficientFunds), "got %v", err)
	appErr, ok := apperrors.AsAppError(err)
	require.True(t, ok)
	assert.Equal(t, funds.InsufficientFundsCode, appErr.Code)
	assert.Empty(t, txs.calls, "nothing is disbursed")
}

func TestCreateLoan_AllowsDisbursementOfExactBalance(t *testing.T) {
	svc := NewLoanService(stubLoanRepo{}, &recordingTransactions{}, spentAccounts{}, &memoryCategories{})

	_, err := svc.CreateLoan(context.Background(), newLoanRequest("100", ""), "user-1")
	require.NoError(t, err)
}

// Balances in different currencies are not comparable, so a loan in another
// currency than its source account is not checked.
func TestCreateLoan_DoesNotCompareAcrossCurrencies(t *testing.T) {
	svc := NewLoanService(stubLoanRepo{}, &recordingTransactions{}, spentAccounts{}, &memoryCategories{})

	_, err := svc.CreateLoan(context.Background(), newLoanRequest("500", "USD"), "user-1")
	require.NoError(t, err)
}

// loans.principal_amount is DECIMAL(15,2): sub-cent principals are rejected
// instead of being rounded.
func TestCreateLoan_RejectsSubCentPrincipal(t *testing.T) {
	svc := NewLoanService(stubLoanRepo{}, &recordingTransactions{}, stubAccounts{}, &memoryCategories{})

	_, err := svc.CreateLoan(context.Background(), newLoanRequest("10.005", ""), "user-1")
	assert.True(t, errors.Is(err, errorhttp.ErrBadRequest))
	assert.Contains(t, err.Error(), "principal_amount must have at most 2 decimal places")
}

var _ AccountRepositoryInterface = spentAccounts{}
