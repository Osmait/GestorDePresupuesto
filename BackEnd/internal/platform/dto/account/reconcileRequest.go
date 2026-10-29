package dto

import (
	"errors"
	"strings"

	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
)

// maxReconcileBalance bounds |bank_balance| like the account balances.
var maxReconcileBalance = money.MustParse("999999999.99")

// ReconcileRequest is the balance the user's bank shows for the account right
// now. BankBalance is a pointer so a missing field (400) is told apart from a
// zero balance; it may be negative (an overdrawn account).
type ReconcileRequest struct {
	BankBalance *money.Amount `json:"bank_balance" example:"48162.50"`
	// Currency of the balance (DOP or USD); empty means the account's currency.
	Currency string `json:"currency,omitempty" binding:"omitempty,max=3" example:"DOP"`
	Notes    string `json:"notes,omitempty" binding:"max=500" example:"Saldo de la app del banco"`
}

// Validate checks the fields binding cannot express.
func (r *ReconcileRequest) Validate() error {
	if r.BankBalance == nil {
		return errors.New("bank_balance is required")
	}
	if r.BankBalance.Abs().GreaterThan(maxReconcileBalance) {
		return errors.New("bank_balance is too large")
	}
	if c := strings.ToUpper(strings.TrimSpace(r.Currency)); c != "" && c != "DOP" && c != "USD" {
		return errors.New("currency must be 'DOP' or 'USD'")
	}
	return nil
}
