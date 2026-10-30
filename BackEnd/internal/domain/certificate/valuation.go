package certificate

import "github.com/osmait/gestorDePresupuesto/internal/domain/money"

// CapitalizesInterest reports whether the certificate adds its net interest
// to the capital (compound with reinvestment). Any other certificate pays the
// interest out: to its payout account when it has one (an income transaction
// there), otherwise outside the app.
func (c *Certificate) CapitalizesInterest() bool {
	return c.InterestType == InterestTypeCompound && c.ReinvestInterest
}

// PaysOutInterest reports whether each interest payment is credited to the
// payout account as an income transaction.
func (c *Certificate) PaysOutInterest() bool {
	return !c.CapitalizesInterest() && c.PayoutAccountId != nil && *c.PayoutAccountId != ""
}

// CurrencyCode is the normalized currency of the certificate (DOP when empty).
func (c *Certificate) CurrencyCode() string {
	return money.NormalizeCurrency(c.Currency, money.CurrencyDOP)
}

// IsActive reports whether the certificate still holds its capital.
func (c *Certificate) IsActive() bool {
	return c.Status == StatusActive
}

// CurrentValue is what the certificate is worth now, in its currency: the
// base capital, plus the net interest capitalized so far when it reinvests
// (the capital of its last payment plus that payment's net interest).
// Interest paid out is not part of it: it was credited to the payout account
// (and counts in the account's balance) or paid outside the app. lastPayment
// is the newest payment of the certificate, or nil.
//
// It is the capital the next payment is computed on (see the certificate
// service's effective capital), so the value shown and the one that earns
// interest agree.
func (c *Certificate) CurrentValue(lastPayment *CertificatePayment) money.Amount {
	if c.CapitalizesInterest() && lastPayment != nil {
		return lastPayment.AppliedCapital.Add(lastPayment.NetInterest)
	}
	return c.BaseCapital
}

// LatestPayments returns the newest payment (by payment date) of each
// certificate in payments, keyed by certificate id.
func LatestPayments(payments []*CertificatePayment) map[string]*CertificatePayment {
	latest := make(map[string]*CertificatePayment)
	for _, p := range payments {
		if p == nil {
			continue
		}
		if cur, ok := latest[p.CertificateId]; !ok || p.PaymentDate.After(cur.PaymentDate) {
			latest[p.CertificateId] = p
		}
	}
	return latest
}
