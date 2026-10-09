// Package money provides Amount, the exact decimal type used for every
// monetary value in the backend: amounts, balances, prices, quantities,
// exchange rates, budget limits, interest and so on.
//
// # Why a wrapper type
//
// Amount wraps shopspring/decimal instead of using decimal.Decimal directly so
// that its wire and storage behaviour is fixed by the type itself rather than
// by mutable package globals (decimal.MarshalJSONWithoutQuotes). Amount always
// encodes to JSON as a bare number (never a string), so clients that decode
// JSON numbers (TypeScript number, Swift Double/Decimal) keep working, and it
// decodes both JSON numbers and numeric strings without ever passing through
// float64.
//
// # Rounding policy
//
//   - Inputs are parsed exactly from their textual form (JSON, query params,
//     database NUMERIC). No float64 is involved.
//   - Addition, subtraction and multiplication are exact.
//   - Division is carried out with DivisionScale (16) fractional digits and the
//     caller rounds the result to its target scale.
//   - Derived monetary values (currency conversions, interest, averages,
//     installments) are rounded half-even ("banker's rounding") to CentsScale
//     (2) with RoundCents. Monetary columns are DECIMAL(x,4) or DECIMAL(x,2),
//     so a value rounded to cents is always stored exactly.
//   - Values typed by the user are stored as given; PostgreSQL rejects or
//     rounds anything beyond the column scale (StorageScale = 4 for
//     DECIMAL(19,4) money columns). Request validation rejects input with
//     more decimals than a DECIMAL(x,2) column holds (CheckCents) instead of
//     letting PostgreSQL round it silently.
//   - Quantities, unit prices and exchange rates are never rounded to cents;
//     derived prices and rates (and floats arriving from external APIs) are
//     rounded half-even to PriceScale / RateScale (10).
//   - Percentages and ratios are computed in decimal, rounded half-even to 2
//     places and only then converted to float64 with Percent/Float64, and
//     only for display.
//   - JSON encoding never rounds: it emits the exact stored value.
package money

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strings"

	"github.com/shopspring/decimal"
)

const (
	// CentsScale is the scale used for presentation and derived amounts.
	CentsScale int32 = 2
	// StorageScale is the scale of DECIMAL(19,4) money columns.
	StorageScale int32 = 4
	// RateScale is the scale of exchange rates (NUMERIC(24,10) columns).
	RateScale int32 = 10
	// PriceScale is the scale of investment unit prices (NUMERIC(28,10)),
	// wide enough for sub-cent crypto prices.
	PriceScale int32 = 10
	// DivisionScale is the number of fractional digits kept by Div before the
	// caller rounds to its target scale.
	DivisionScale int32 = 16

	// maxExponent bounds the decimal exponent accepted from untrusted input so
	// values such as "1e999999999" cannot make String() allocate gigabytes.
	maxExponent = 40
	// maxDigits bounds the number of significant digits accepted from input.
	maxDigits = 60
)

// ErrInvalidAmount is returned when a value cannot be parsed as an amount.
var ErrInvalidAmount = errors.New("money: invalid amount")

// Amount is an exact decimal number. The zero value is 0 and ready to use.
type Amount struct {
	d decimal.Decimal
}

// Zero is the zero amount.
var Zero = Amount{}

// FromDecimal wraps a decimal.Decimal.
func FromDecimal(d decimal.Decimal) Amount { return Amount{d: d} }

// FromInt returns the integer amount v.
func FromInt(v int64) Amount { return Amount{d: decimal.NewFromInt(v)} }

// New returns value * 10^exp, e.g. New(1999, -2) == 19.99.
func New(value int64, exp int32) Amount { return Amount{d: decimal.New(value, exp)} }

// Parse parses a decimal string such as "1234.5678" or "-0.01".
func Parse(s string) (Amount, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return Zero, fmt.Errorf("%w: empty string", ErrInvalidAmount)
	}
	d, err := decimal.NewFromString(s)
	if err != nil {
		return Zero, fmt.Errorf("%w: %q", ErrInvalidAmount, s)
	}
	if exp := d.Exponent(); exp > maxExponent || exp < -maxExponent || d.NumDigits() > maxDigits {
		return Zero, fmt.Errorf("%w: %q is out of range", ErrInvalidAmount, s)
	}
	return Amount{d: d}, nil
}

// MustParse is like Parse but panics on error. Intended for constants and
// tests.
func MustParse(s string) Amount {
	a, err := Parse(s)
	if err != nil {
		panic(err)
	}
	return a
}

// FromFloat converts a float64 using its shortest exact decimal
// representation (0.1 -> 0.1). It panics on NaN or ±Inf. Production code
// should only call it at boundaries that inherently produce floats, and
// should prefer FromExternalFloat there.
func FromFloat(f float64) Amount { return Amount{d: decimal.NewFromFloat(f)} }

// FromExternalFloat converts a float produced by an external system (LLM
// output, third-party API) exactly once, rounding half-even to places. NaN
// and ±Inf are rejected.
func FromExternalFloat(f float64, places int32) (Amount, error) {
	if math.IsNaN(f) || math.IsInf(f, 0) {
		return Zero, fmt.Errorf("%w: non-finite float %v", ErrInvalidAmount, f)
	}
	return Amount{d: decimal.NewFromFloat(f)}.Round(places), nil
}

// Decimal returns the underlying decimal.Decimal.
func (a Amount) Decimal() decimal.Decimal { return a.d }

// Add returns a + b.
func (a Amount) Add(b Amount) Amount { return Amount{d: a.d.Add(b.d)} }

// Sub returns a - b.
func (a Amount) Sub(b Amount) Amount { return Amount{d: a.d.Sub(b.d)} }

// Mul returns a * b (exact).
func (a Amount) Mul(b Amount) Amount { return Amount{d: a.d.Mul(b.d)} }

// MulInt returns a * n (exact).
func (a Amount) MulInt(n int64) Amount { return Amount{d: a.d.Mul(decimal.NewFromInt(n))} }

// Div returns a / b with DivisionScale fractional digits. The caller is
// expected to round the result to its target scale. It panics when b is zero.
func (a Amount) Div(b Amount) Amount { return Amount{d: a.d.DivRound(b.d, DivisionScale)} }

// DivInt returns a / n with DivisionScale fractional digits.
func (a Amount) DivInt(n int64) Amount { return a.Div(FromInt(n)) }

// DivOrZero is Div but returns zero when b is zero.
func (a Amount) DivOrZero(b Amount) Amount {
	if b.IsZero() {
		return Zero
	}
	return a.Div(b)
}

// Neg returns -a.
func (a Amount) Neg() Amount { return Amount{d: a.d.Neg()} }

// Abs returns |a|.
func (a Amount) Abs() Amount { return Amount{d: a.d.Abs()} }

// Round rounds half-even (banker's rounding) to places fractional digits.
func (a Amount) Round(places int32) Amount { return Amount{d: a.d.RoundBank(places)} }

// RoundCents rounds half-even to CentsScale (2) fractional digits.
func (a Amount) RoundCents() Amount { return a.Round(CentsScale) }

// HasMaxScale reports whether a has at most places significant fractional
// digits. Trailing zeros do not count: 1.500 has scale 1.
func (a Amount) HasMaxScale(places int32) bool { return a.d.Equal(a.d.Truncate(places)) }

// ErrTooManyDecimals is returned by CheckScale when an input amount has more
// fractional digits than the column that stores it.
var ErrTooManyDecimals = errors.New("too many decimal places")

// CheckScale rejects a user-typed amount that a DECIMAL(x,places) column
// would silently round (e.g. 0.001 into a cents column). field names the
// request field in the error message.
func CheckScale(field string, a Amount, places int32) error {
	if a.HasMaxScale(places) {
		return nil
	}
	return fmt.Errorf("%w: %s must have at most %d decimal places", ErrTooManyDecimals, field, places)
}

// CheckCents is CheckScale with CentsScale (2), the scale of the
// DECIMAL(15,2) money columns (card payments and balances, loans,
// certificates, recurring transactions, monthly plan items).
func CheckCents(field string, a Amount) error { return CheckScale(field, a, CentsScale) }

// Cmp returns -1, 0 or +1.
func (a Amount) Cmp(b Amount) int { return a.d.Cmp(b.d) }

// Equal reports whether a == b numerically (1.50 equals 1.5).
func (a Amount) Equal(b Amount) bool { return a.d.Equal(b.d) }

// GreaterThan reports a > b.
func (a Amount) GreaterThan(b Amount) bool { return a.d.GreaterThan(b.d) }

// GreaterThanOrEqual reports a >= b.
func (a Amount) GreaterThanOrEqual(b Amount) bool { return a.d.GreaterThanOrEqual(b.d) }

// LessThan reports a < b.
func (a Amount) LessThan(b Amount) bool { return a.d.LessThan(b.d) }

// LessThanOrEqual reports a <= b.
func (a Amount) LessThanOrEqual(b Amount) bool { return a.d.LessThanOrEqual(b.d) }

// Sign returns -1, 0 or +1.
func (a Amount) Sign() int { return a.d.Sign() }

// IsZero reports a == 0. It also makes `json:",omitzero"` omit zero amounts,
// matching the previous `omitempty` behaviour of float64 fields.
func (a Amount) IsZero() bool { return a.d.IsZero() }

// IsPositive reports a > 0.
func (a Amount) IsPositive() bool { return a.d.IsPositive() }

// IsNegative reports a < 0.
func (a Amount) IsNegative() bool { return a.d.IsNegative() }

// IntPart returns the integer part of a.
func (a Amount) IntPart() int64 { return a.d.IntPart() }

// Float64 returns the nearest float64. Use it only for display-only ratios
// or to hand a value to an API that requires a float (e.g. an LLM prompt);
// never feed the result back into money arithmetic.
func (a Amount) Float64() float64 { return a.d.InexactFloat64() }

// String returns the exact value without trailing zeros, e.g. "1000.5".
func (a Amount) String() string { return a.d.String() }

// StringFixed returns the value rounded half-even to places digits, padded
// with zeros, e.g. "1000.50".
func (a Amount) StringFixed(places int32) string { return a.d.StringFixedBank(places) }

// Min returns the smallest of the given amounts.
func Min(first Amount, rest ...Amount) Amount {
	m := first
	for _, a := range rest {
		if a.LessThan(m) {
			m = a
		}
	}
	return m
}

// Max returns the largest of the given amounts.
func Max(first Amount, rest ...Amount) Amount {
	m := first
	for _, a := range rest {
		if a.GreaterThan(m) {
			m = a
		}
	}
	return m
}

// Sum returns the exact sum of the given amounts.
func Sum(amounts ...Amount) Amount {
	total := Zero
	for _, a := range amounts {
		total = total.Add(a)
	}
	return total
}

// Percent returns part/whole*100 computed in decimal and rounded half-even
// to 2 places, as a float64 for display. It returns 0 when whole is zero.
// The result is display-only and must not be used in money arithmetic.
func Percent(part, whole Amount) float64 {
	if whole.IsZero() {
		return 0
	}
	return part.Mul(FromInt(100)).Div(whole).Round(2).Float64()
}

// MarshalJSON encodes the exact value as a bare JSON number.
func (a Amount) MarshalJSON() ([]byte, error) {
	return []byte(a.d.String()), nil
}

// UnmarshalJSON accepts a JSON number (123.45) or a numeric string
// ("123.45"). JSON null leaves the amount unchanged, like it does for
// float64.
func (a *Amount) UnmarshalJSON(data []byte) error {
	s := strings.TrimSpace(string(data))
	if s == "null" {
		return nil
	}
	if strings.HasPrefix(s, `"`) {
		var unquoted string
		if err := json.Unmarshal(data, &unquoted); err != nil {
			return fmt.Errorf("%w: %s", ErrInvalidAmount, s)
		}
		s = unquoted
	}
	parsed, err := Parse(s)
	if err != nil {
		return err
	}
	*a = parsed
	return nil
}

// MarshalText implements encoding.TextMarshaler.
func (a Amount) MarshalText() ([]byte, error) { return []byte(a.d.String()), nil }

// UnmarshalText implements encoding.TextUnmarshaler.
func (a *Amount) UnmarshalText(text []byte) error {
	parsed, err := Parse(string(text))
	if err != nil {
		return err
	}
	*a = parsed
	return nil
}

// UnmarshalParam lets gin bind query/form parameters into an Amount.
func (a *Amount) UnmarshalParam(param string) error { return a.UnmarshalText([]byte(param)) }

// Scan implements sql.Scanner for NUMERIC/DECIMAL columns (and float or
// integer columns, for which the driver value is converted exactly once).
// NULL scans as zero; use NullAmount for nullable columns.
func (a *Amount) Scan(src any) error {
	if src == nil {
		*a = Zero
		return nil
	}
	var d decimal.Decimal
	if err := d.Scan(src); err != nil {
		return fmt.Errorf("%w: %v", ErrInvalidAmount, err)
	}
	*a = Amount{d: d}
	return nil
}

// Value implements driver.Valuer. The value is sent as its exact decimal
// text, which PostgreSQL casts to the column's NUMERIC type.
func (a Amount) Value() (driver.Value, error) { return a.d.String(), nil }

// NullAmount is an Amount that may be NULL (SQL) / null (JSON).
type NullAmount struct {
	Amount Amount
	Valid  bool
}

// NewNullAmount returns a valid NullAmount holding a.
func NewNullAmount(a Amount) NullAmount { return NullAmount{Amount: a, Valid: true} }

// NullAmountFromPtr converts a pointer (nil -> NULL).
func NullAmountFromPtr(a *Amount) NullAmount {
	if a == nil {
		return NullAmount{}
	}
	return NewNullAmount(*a)
}

// Ptr returns nil when the value is NULL.
func (n NullAmount) Ptr() *Amount {
	if !n.Valid {
		return nil
	}
	a := n.Amount
	return &a
}

// OrZero returns the amount, or zero when NULL.
func (n NullAmount) OrZero() Amount {
	if !n.Valid {
		return Zero
	}
	return n.Amount
}

// IsZero reports whether the value is NULL, so `json:",omitzero"` behaves
// like `omitempty` on a *float64.
func (n NullAmount) IsZero() bool { return !n.Valid }

// Scan implements sql.Scanner.
func (n *NullAmount) Scan(src any) error {
	if src == nil {
		*n = NullAmount{}
		return nil
	}
	if err := n.Amount.Scan(src); err != nil {
		return err
	}
	n.Valid = true
	return nil
}

// Value implements driver.Valuer.
func (n NullAmount) Value() (driver.Value, error) {
	if !n.Valid {
		return nil, nil
	}
	return n.Amount.Value()
}

// MarshalJSON encodes null or a bare JSON number.
func (n NullAmount) MarshalJSON() ([]byte, error) {
	if !n.Valid {
		return []byte("null"), nil
	}
	return n.Amount.MarshalJSON()
}

// UnmarshalJSON accepts null, a JSON number or a numeric string.
func (n *NullAmount) UnmarshalJSON(data []byte) error {
	if strings.TrimSpace(string(data)) == "null" {
		*n = NullAmount{}
		return nil
	}
	var a Amount
	if err := a.UnmarshalJSON(data); err != nil {
		return err
	}
	*n = NewNullAmount(a)
	return nil
}
