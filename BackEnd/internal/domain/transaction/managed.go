package transaction

// Only plain incomes and expenses are the user's own records: every other
// type is written by the app as part of a larger operation (card payment,
// loan, broker funding, balance adjustment) and is paired with other rows
// (card_payments, loan payments, the funding ledger, the other side of a
// transfer). Creating, editing or deleting one through the generic
// transaction endpoints would desync those records and could bypass the
// overdraft check.
const (
	typeIncome        = "income"
	typeBill          = "bill"
	typeAdjustmentIn  = "adjustment_in"
	typeAdjustmentOut = "adjustment_out"
)

// IsUserType reports whether a transaction of type t can be created or edited
// directly (and whether another transaction can be turned into type t).
func IsUserType(t string) bool {
	return t == typeIncome || t == typeBill
}

// IsEditable reports whether a transaction of type t can be edited directly.
func IsEditable(t string) bool {
	return IsUserType(t)
}

// IsDeletable reports whether a transaction of type t can be deleted on its
// own: the user's incomes and expenses, and balance adjustments (deleting one
// undoes it; it has no paired rows).
func IsDeletable(t string) bool {
	return IsUserType(t) || t == typeAdjustmentIn || t == typeAdjustmentOut
}
