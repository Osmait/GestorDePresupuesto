package account

import (
	"time"

	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
)

// Transaction types of a balance adjustment (migration 000058). The amount is
// always positive; adjustment_in adds to the balance, adjustment_out
// subtracts. Reports count neither as income nor as expense.
const (
	AdjustmentIn  = "adjustment_in"
	AdjustmentOut = "adjustment_out"
)

// Reconciliation records one check of an account against the balance the
// bank shows. AppBalance is the app's balance before the check, BankBalance
// the one the user typed; when they differ, TransactionId is the adjustment
// transaction that moved the account by Difference().
type Reconciliation struct {
	Id            string       `json:"id"`
	UserId        string       `json:"-"`
	AccountId     string       `json:"account_id"`
	Currency      string       `json:"currency"`
	AppBalance    money.Amount `json:"app_balance"`
	BankBalance   money.Amount `json:"bank_balance"`
	TransactionId string       `json:"transaction_id,omitempty"`
	Notes         string       `json:"notes"`
	CreatedAt     time.Time    `json:"created_at"`
}

// Difference is the amount the adjustment moved the account by (positive:
// money added, negative: money removed).
func (r *Reconciliation) Difference() money.Amount {
	return r.BankBalance.Sub(r.AppBalance)
}

// AdjustmentType is the transaction type that moves the balance by diff, and
// false when diff is zero (no adjustment needed).
func AdjustmentType(diff money.Amount) (string, bool) {
	switch {
	case diff.IsPositive():
		return AdjustmentIn, true
	case diff.IsNegative():
		return AdjustmentOut, true
	default:
		return "", false
	}
}
