// Package funds guards money movements that debit an account as the source of
// a transfer (credit-card payments, broker funding, loan disbursements) against
// overdrafts.
//
// Ordinary expense transactions are deliberately NOT checked: they record
// real-world spending that already happened, so the ledger must accept them
// even when they leave the account negative.
//
// # Concurrency
//
// Callers lock the source account row first (FindByIdAndUserIdForUpdate, a
// SELECT ... FOR NO KEY UPDATE inside the request transaction) and only then
// call Require. A concurrent debit of the same account blocks on that lock
// until the first request commits or rolls back; under READ COMMITTED its
// balance query then sees the committed debit, so two movements that each fit
// but not together can never both pass.
//
// The balance comes from the trigger-maintained account_balances table
// (migration 000052), so the check is an index lookup however long the
// account's history is. The lock does not block ordinary transaction INSERTs
// on the account (their foreign key takes FOR KEY SHARE, which FOR NO KEY
// UPDATE does not conflict with): an expense recorded concurrently may still
// take the account below zero, exactly as if it had been recorded right after
// the debit — expenses are never checked (see above).
package funds

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/osmait/gestorDePresupuesto/internal/domain/account"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
	apperrors "github.com/osmait/gestorDePresupuesto/internal/platform/errors"
)

// InsufficientFundsCode is the stable API error code of an overdraft attempt.
const InsufficientFundsCode = "INSUFFICIENT_FUNDS"

// ErrInsufficientFunds is the cause of every error returned by Require; test
// with errors.Is.
var ErrInsufficientFunds = errors.New("insufficient funds")

// Ledger returns the net total of an account's transactions; the account's
// initial balance plus this total is the current_balance the API reports.
type Ledger interface {
	Balance(ctx context.Context, id string, userId string) (money.Amount, error)
}

// CurrentBalance returns acc's balance computed the same way the accounts API
// computes current_balance: initial balance + net transactions.
func CurrentBalance(ctx context.Context, ledger Ledger, acc *account.Account, userID string) (money.Amount, error) {
	movements, err := ledger.Balance(ctx, acc.Id, userID)
	if err != nil {
		return money.Zero, err
	}
	return acc.InitialBalance.Add(movements), nil
}

// Require returns an INSUFFICIENT_FUNDS validation error (HTTP 400) when the
// current balance of acc, in the account's own currency, is lower than amount.
// acc must have been read with a row lock in the current request transaction.
func Require(ctx context.Context, ledger Ledger, acc *account.Account, userID string, amount money.Amount) error {
	available, err := CurrentBalance(ctx, ledger, acc, userID)
	if err != nil {
		return err
	}
	if !available.LessThan(amount) {
		return nil
	}
	return NewInsufficientFundsError(accountCurrency(acc), available, amount)
}

// NewInsufficientFundsError builds the API error for an overdraft attempt.
func NewInsufficientFundsError(currency string, available, required money.Amount) *apperrors.AppError {
	return apperrors.NewValidationError(InsufficientFundsCode, fmt.Sprintf(
		"insufficient funds: the source account has %s %s available but the operation needs %s %s",
		available.StringFixed(money.CentsScale), currency, required.StringFixed(money.CentsScale), currency,
	)).
		WithCause(ErrInsufficientFunds).
		WithDetails(map[string]interface{}{
			"currency":  currency,
			"available": available.StringFixed(money.CentsScale),
			"required":  required.StringFixed(money.CentsScale),
		})
}

func accountCurrency(acc *account.Account) string {
	if c := strings.ToUpper(strings.TrimSpace(acc.Currency)); c != "" {
		return c
	}
	return "DOP"
}
