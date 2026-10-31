package loan

import "github.com/osmait/gestorDePresupuesto/internal/domain/money"

// CurrencyCode is the normalized currency of the loan (DOP when empty).
func (l *Loan) CurrencyCode() string {
	return money.NormalizeCurrency(l.Currency, money.CurrencyDOP)
}

// OutstandingPrincipal is the principal not yet collected (never negative):
// the part of the disbursement still owed to the user. Interest not yet
// collected is not included: it is earned only when it is paid.
func (l *Loan) OutstandingPrincipal() money.Amount {
	return money.Max(l.PrincipalAmount.Sub(l.PaidPrincipal), money.Zero)
}

// Pending is what the borrower still owes, principal plus interest (never
// negative).
func (l *Loan) Pending() money.Amount {
	return money.Max(l.TotalAmount.Sub(l.PaidPrincipal.Add(l.PaidInterest)), money.Zero)
}

// IsReceivable reports whether the loan counts as money owed to the user:
// only active loans. A paid loan owes nothing, a cancelled one refunded its
// pending principal to the source account, and a defaulted one is written
// off (reported apart, never added to totals or net worth).
func (l *Loan) IsReceivable() bool {
	return l.Status == LoanStatusActive
}
