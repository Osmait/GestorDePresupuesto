package investment

import (
	"context"
	"errors"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/osmait/gestorDePresupuesto/internal/domain/account"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
	apperrors "github.com/osmait/gestorDePresupuesto/internal/platform/errors"
	accountRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/account"
	categoryRepo "github.com/osmait/gestorDePresupuesto/internal/platform/storage/postgress/category"
	"github.com/osmait/gestorDePresupuesto/internal/services/errorhttp"
	"github.com/osmait/gestorDePresupuesto/internal/services/funds"
	"github.com/osmait/gestorDePresupuesto/internal/services/transaction"
)

// stubAccountRepo only implements the account lookups and Balance; any other
// call panics.
type stubAccountRepo struct {
	accountRepo.AccountRepositoryInterface
	account   *account.Account
	movements money.Amount
	locked    bool
}

func (s *stubAccountRepo) FindByIdAndUserId(context.Context, string, string) (*account.Account, error) {
	return s.account, nil
}

func (s *stubAccountRepo) FindByIdAndUserIdForUpdate(context.Context, string, string) (*account.Account, error) {
	s.locked = true
	return s.account, nil
}

func (s *stubAccountRepo) Balance(context.Context, string, string) (money.Amount, error) {
	return s.movements, nil
}

// noCategoryRepo panics on use: a rejected funding must not touch categories.
type noCategoryRepo struct {
	categoryRepo.CategoryRepoInterface
}

func TestFundBroker_RejectsCreditCardSourceAccount(t *testing.T) {
	card := account.NewCreditCardAccount("card-1", "Visa", "BHD")
	card.UserId = "user-1"
	svc := NewInvestmentService(&MockInvestmentRepository{}, nil, &transaction.TransactionService{}, &stubAccountRepo{account: card}, noCategoryRepo{})

	err := svc.FundBroker(context.Background(), "user-1", FundingRequest{
		SourceAccountID: "card-1",
		SourceAmount:    money.FromInt(100),
		TargetCurrency:  "DOP",
	})

	assert.True(t, errors.Is(err, ErrCreditCardFundingSource))
	assert.True(t, errors.Is(err, errorhttp.ErrBadRequest), "must map to HTTP 400")
	assert.Contains(t, err.Error(), "credit card")
}

// Broker funding is a transfer out of the source account: it must not leave
// the account negative. The fee is debited from the same account and counts.
func TestFundBroker_RejectsOverdraft(t *testing.T) {
	bank := account.NewAccount(money.FromInt(1000), "acc-1", "Checking", "BHD")
	bank.UserId = "user-1"
	repo := &stubAccountRepo{account: bank, movements: money.FromInt(-900)} // 100.00 available
	svc := NewInvestmentService(&MockInvestmentRepository{}, nil, &transaction.TransactionService{}, repo, noCategoryRepo{})

	err := svc.FundBroker(context.Background(), "user-1", FundingRequest{
		SourceAccountID: "acc-1",
		SourceAmount:    money.FromInt(95),
		FeeAmount:       money.MustParse("5.01"),
	})

	assert.True(t, errors.Is(err, funds.ErrInsufficientFunds), "got %v", err)
	assert.True(t, repo.locked, "the source account must be locked before the check")
	appErr, ok := apperrors.AsAppError(err)
	if assert.True(t, ok) {
		assert.Equal(t, funds.InsufficientFundsCode, appErr.Code)
		assert.Equal(t, http.StatusBadRequest, appErr.ToHTTPStatus())
	}
}
