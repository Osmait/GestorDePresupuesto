package money

import "strings"

// FallbackUsdToDopRate is the USD->DOP rate used when the exchange-rate
// service is unreachable or returns a non-positive rate. It matches the
// fallback (60) of the transaction, budget and monthly plan modules.
var FallbackUsdToDopRate = FromInt(60)

// The currencies the app supports. Totals that mix them (net worth, loan and
// certificate summaries) are reported in DOP, converting USD at the USD->DOP
// rate.
const (
	CurrencyDOP = "DOP"
	CurrencyUSD = "USD"
)

// NormalizeCurrency returns currency trimmed and upper-cased, or def when it
// is empty. It does not validate the code (see IsSupportedCurrency).
func NormalizeCurrency(currency, def string) string {
	if c := strings.ToUpper(strings.TrimSpace(currency)); c != "" {
		return c
	}
	return def
}

// IsSupportedCurrency reports whether currency (already normalized) is DOP or
// USD.
func IsSupportedCurrency(currency string) bool {
	return currency == CurrencyDOP || currency == CurrencyUSD
}

// ToDOP converts amount, expressed in currency (already normalized), to DOP:
// DOP is returned as is and USD is multiplied by usdToDop, exactly (callers
// round the totals they present). ok is false for any other currency, which
// cannot be converted: callers leave it out of DOP totals.
func ToDOP(amount Amount, currency string, usdToDop Amount) (dop Amount, ok bool) {
	switch currency {
	case CurrencyDOP:
		return amount, true
	case CurrencyUSD:
		return amount.Mul(usdToDop), true
	default:
		return Zero, false
	}
}

// Convert converts amount from currency `from` to currency `to` (both
// normalized) at usdToDop, exactly: USD->DOP multiplies by the rate and
// DOP->USD divides by it (to DivisionScale). ok is false when either currency
// is not supported, or when a conversion is needed and usdToDop is not
// positive.
func Convert(amount Amount, from, to string, usdToDop Amount) (converted Amount, ok bool) {
	if !IsSupportedCurrency(from) || !IsSupportedCurrency(to) {
		return Zero, false
	}
	if from == to {
		return amount, true
	}
	if !usdToDop.IsPositive() {
		return Zero, false
	}
	if from == CurrencyUSD {
		return amount.Mul(usdToDop), true
	}
	return amount.Div(usdToDop), true
}
