package transaction

// Transaction types the app writes on its own and the user must not edit
// directly: balance adjustments (reconcile, card initial debt and resets) and
// the card side of a card payment. The form and the API only know income/bill,
// so editing one would turn it into an expense or income and break the balance
// it keeps.
const (
	typeAdjustmentIn        = "adjustment_in"
	typeAdjustmentOut       = "adjustment_out"
	typeCardPaymentReceived = "card_payment_received"
)

// IsEditable reports whether a transaction of type t can be edited (or another
// transaction turned into type t).
func IsEditable(t string) bool {
	switch t {
	case typeAdjustmentIn, typeAdjustmentOut, typeCardPaymentReceived:
		return false
	default:
		return true
	}
}

// IsDeletable reports whether a transaction of type t can be deleted on its
// own. Deleting an adjustment undoes it; a card payment received is one side of
// a payment (the paying account keeps its card_payment), so it cannot.
func IsDeletable(t string) bool {
	return t != typeCardPaymentReceived
}
