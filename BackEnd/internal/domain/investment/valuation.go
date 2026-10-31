package investment

import "github.com/osmait/gestorDePresupuesto/internal/domain/money"

// DefaultSettlementCurrency is the currency of a position stored without one
// (legacy rows and purchases that did not send it): positions were USD-only
// before settlement_currency existed.
const DefaultSettlementCurrency = money.CurrencyUSD

// NormalizeSettlementCurrency returns the stored form of a settlement
// currency: trimmed, upper-cased, DefaultSettlementCurrency when empty.
func NormalizeSettlementCurrency(currency string) string {
	return money.NormalizeCurrency(currency, DefaultSettlementCurrency)
}

// Currency is the currency the position is priced and settled in: its
// purchase_price and current_price are amounts in this currency.
func (i *Investment) Currency() string {
	return NormalizeSettlementCurrency(i.SettlementCurrency)
}

// MarketValue is quantity * current price, exactly, in Currency().
func (i *Investment) MarketValue() money.Amount {
	return i.Quantity.Mul(i.CurrentPrice)
}

// Cost is quantity * purchase price rounded half-even to cents, in
// Currency(): what a purchase of the position takes from the broker wallet.
func (i *Investment) Cost() money.Amount {
	return i.Quantity.Mul(i.PurchasePrice).RoundCents()
}

// QuotedInUSD reports whether the market quotes the app fetches (USD prices
// of the symbol) apply to the position. Only USD positions are refreshed
// from quotes: a DOP position keeps the current price the user entered, as
// writing a USD quote into it would mix currencies.
func (i *Investment) QuotedInUSD() bool {
	return i.Currency() == money.CurrencyUSD
}
