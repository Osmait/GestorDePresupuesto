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
//
// # Representation
//
// An Amount is coefficient * 10^exponent. Values whose coefficient fits in
// an int64 (every realistic amount, rate and price) are held inline as
// (int64, int32) and the hot operations — Scan, Parse, JSON encoding,
// Add/Sub/Mul, Cmp, Round, String — run on them without allocating. Larger
// coefficients (e.g. unrounded 16-digit quotients) fall back to
// shopspring/decimal, and every result that fits is brought back inline.
// The two forms are indistinguishable from outside: coefficients and
// exponents are exactly those decimal.Decimal would produce, so text, JSON
// and SQL output and every rounding result are unchanged.
package money

import (
	"bytes"
	"database/sql/driver"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strconv"
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

	// maxFastDigits is the number of decimal digits that always fit in an
	// int64 coefficient.
	maxFastDigits = 18
)

// ErrInvalidAmount is returned when a value cannot be parsed as an amount.
var ErrInvalidAmount = errors.New("money: invalid amount")

// Amount is an exact decimal number. The zero value is 0 and ready to use.
type Amount struct {
	// Inline form (big == false): c * 10^e.
	c int64
	e int32
	// big reports that the value lives in d (coefficient beyond int64).
	big bool
	d   decimal.Decimal
}

// Zero is the zero amount.
var Zero = Amount{}

// pow10 holds 10^0 .. 10^18.
var pow10 = [...]int64{
	1, 10, 100, 1_000, 10_000, 100_000, 1_000_000, 10_000_000, 100_000_000,
	1_000_000_000, 10_000_000_000, 100_000_000_000, 1_000_000_000_000,
	10_000_000_000_000, 100_000_000_000_000, 1_000_000_000_000_000,
	10_000_000_000_000_000, 100_000_000_000_000_000, 1_000_000_000_000_000_000,
}

// fromDec wraps d, inline when its coefficient fits in an int64.
func fromDec(d decimal.Decimal) Amount {
	if n := d.NumDigits(); n <= maxFastDigits || (n == maxFastDigits+1 && d.Coefficient().IsInt64()) {
		return Amount{c: d.CoefficientInt64(), e: d.Exponent()}
	}
	return Amount{big: true, d: d}
}

// dec returns the value as a decimal.Decimal.
func (a Amount) dec() decimal.Decimal {
	if a.big {
		return a.d
	}
	return decimal.New(a.c, a.e)
}

// scaleUp returns c * 10^n (n >= 0), reporting overflow.
func scaleUp(c int64, n int64) (int64, bool) {
	if n == 0 || c == 0 {
		return c, true
	}
	if n > maxFastDigits {
		return 0, false
	}
	p := pow10[n]
	if c > math.MaxInt64/p || c < math.MinInt64/p {
		return 0, false
	}
	return c * p, true
}

// align rescales two inline values to their smaller exponent, like
// decimal.RescalePair.
func align(a, b Amount) (ca, cb int64, e int32, ok bool) {
	switch {
	case a.e == b.e:
		return a.c, b.c, a.e, true
	case a.e > b.e:
		ca, ok = scaleUp(a.c, int64(a.e)-int64(b.e))
		return ca, b.c, b.e, ok
	default:
		cb, ok = scaleUp(b.c, int64(b.e)-int64(a.e))
		return a.c, cb, a.e, ok
	}
}

// FromDecimal wraps a decimal.Decimal.
func FromDecimal(d decimal.Decimal) Amount { return fromDec(d) }

// FromInt returns the integer amount v.
func FromInt(v int64) Amount { return Amount{c: v} }

// New returns value * 10^exp, e.g. New(1999, -2) == 19.99.
func New(value int64, exp int32) Amount { return Amount{c: value, e: exp} }

// Parse parses a decimal string such as "1234.5678" or "-0.01".
func Parse(s string) (Amount, error) {
	s = strings.TrimSpace(s)
	if s == "" {
		return Zero, fmt.Errorf("%w: empty string", ErrInvalidAmount)
	}
	if a, ok := parseFast(s); ok {
		return a, nil
	}
	d, err := decimal.NewFromString(s)
	if err != nil {
		return Zero, fmt.Errorf("%w: %q", ErrInvalidAmount, s)
	}
	if exp := d.Exponent(); exp > maxExponent || exp < -maxExponent || d.NumDigits() > maxDigits {
		return Zero, fmt.Errorf("%w: %q is out of range", ErrInvalidAmount, s)
	}
	return fromDec(d), nil
}

// parseFast parses the plain form -?digits(.digits)? with at most 18
// digits, exactly as decimal.NewFromString would (the exponent is minus the
// number of fractional digits, trailing zeros included). Anything else is
// left to the general parser.
func parseFast[T string | []byte](s T) (Amount, bool) {
	i := 0
	neg := false
	if len(s) > 0 && s[0] == '-' {
		neg = true
		i = 1
	}
	var c int64
	digits, frac := 0, 0
	point := false
	for ; i < len(s); i++ {
		ch := s[i]
		switch {
		case ch >= '0' && ch <= '9':
			digits++
			if digits > maxFastDigits {
				return Zero, false
			}
			c = c*10 + int64(ch-'0')
			if point {
				frac++
			}
		case ch == '.' && !point:
			point = true
			// Require a digit on both sides of the point.
			if digits == 0 || i == len(s)-1 {
				return Zero, false
			}
		default:
			return Zero, false
		}
	}
	if digits == 0 {
		return Zero, false
	}
	if neg {
		c = -c
	}
	return Amount{c: c, e: int32(-frac)}, true
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
func FromFloat(f float64) Amount { return fromDec(decimal.NewFromFloat(f)) }

// FromExternalFloat converts a float produced by an external system (LLM
// output, third-party API) exactly once, rounding half-even to places. NaN
// and ±Inf are rejected.
func FromExternalFloat(f float64, places int32) (Amount, error) {
	if math.IsNaN(f) || math.IsInf(f, 0) {
		return Zero, fmt.Errorf("%w: non-finite float %v", ErrInvalidAmount, f)
	}
	return FromFloat(f).Round(places), nil
}

// Decimal returns the underlying decimal.Decimal.
func (a Amount) Decimal() decimal.Decimal { return a.dec() }

// Add returns a + b.
func (a Amount) Add(b Amount) Amount {
	if !a.big && !b.big {
		if ca, cb, e, ok := align(a, b); ok {
			if s := ca + cb; (s > ca) == (cb > 0) {
				return Amount{c: s, e: e}
			}
		}
	}
	return fromDec(a.dec().Add(b.dec()))
}

// Sub returns a - b.
func (a Amount) Sub(b Amount) Amount {
	if !a.big && !b.big {
		if ca, cb, e, ok := align(a, b); ok {
			if s := ca - cb; (s < ca) == (cb > 0) {
				return Amount{c: s, e: e}
			}
		}
	}
	return fromDec(a.dec().Sub(b.dec()))
}

// Mul returns a * b (exact).
func (a Amount) Mul(b Amount) Amount {
	if !a.big && !b.big {
		e := int64(a.e) + int64(b.e)
		if e >= math.MinInt32 && e <= math.MaxInt32 {
			if a.c == 0 || b.c == 0 {
				return Amount{c: 0, e: int32(e)}
			}
			p := a.c * b.c
			if p/b.c == a.c && (a.c != -1 || b.c != math.MinInt64) && (b.c != -1 || a.c != math.MinInt64) {
				return Amount{c: p, e: int32(e)}
			}
		}
	}
	return fromDec(a.dec().Mul(b.dec()))
}

// MulInt returns a * n (exact).
func (a Amount) MulInt(n int64) Amount { return a.Mul(FromInt(n)) }

// Div returns a / b with DivisionScale fractional digits. The caller is
// expected to round the result to its target scale. It panics when b is zero.
func (a Amount) Div(b Amount) Amount { return fromDec(a.dec().DivRound(b.dec(), DivisionScale)) }

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
func (a Amount) Neg() Amount {
	if !a.big && a.c != math.MinInt64 {
		return Amount{c: -a.c, e: a.e}
	}
	return fromDec(a.dec().Neg())
}

// Abs returns |a|.
func (a Amount) Abs() Amount {
	if !a.big && a.c >= 0 {
		return a
	}
	if !a.big && a.c != math.MinInt64 {
		return Amount{c: -a.c, e: a.e}
	}
	return fromDec(a.dec().Abs())
}

// Round rounds half-even (banker's rounding) to places fractional digits.
// Like decimal.RoundBank, the result always has exponent -places.
func (a Amount) Round(places int32) Amount {
	if !a.big {
		target := -int64(places)
		switch shift := target - int64(a.e); {
		case shift == 0:
			return a
		case shift < 0:
			// Fewer fractional digits than places: only the scale changes.
			if c, ok := scaleUp(a.c, -shift); ok {
				return Amount{c: c, e: int32(target)}
			}
		case shift <= maxFastDigits:
			p := pow10[shift]
			q, r := a.c/p, a.c%p
			if r < 0 {
				r = -r
			}
			// 2r < 2*10^18 cannot overflow.
			if twice := 2 * r; twice > p || (twice == p && q%2 != 0) {
				if a.c < 0 {
					q--
				} else {
					q++
				}
			}
			return Amount{c: q, e: int32(target)}
		}
	}
	return fromDec(a.dec().RoundBank(places))
}

// RoundCents rounds half-even to CentsScale (2) fractional digits.
func (a Amount) RoundCents() Amount { return a.Round(CentsScale) }

// HasMaxScale reports whether a has at most places significant fractional
// digits. Trailing zeros do not count: 1.500 has scale 1.
func (a Amount) HasMaxScale(places int32) bool {
	if !a.big && places >= 0 {
		shift := -int64(places) - int64(a.e)
		if shift <= 0 {
			return true
		}
		if shift <= maxFastDigits {
			return a.c%pow10[shift] == 0
		}
		return a.c == 0
	}
	d := a.dec()
	return d.Equal(d.Truncate(places))
}

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
func (a Amount) Cmp(b Amount) int {
	if !a.big && !b.big {
		if ca, cb, _, ok := align(a, b); ok {
			switch {
			case ca < cb:
				return -1
			case ca > cb:
				return 1
			}
			return 0
		}
	}
	return a.dec().Cmp(b.dec())
}

// Equal reports whether a == b numerically (1.50 equals 1.5).
func (a Amount) Equal(b Amount) bool { return a.Cmp(b) == 0 }

// GreaterThan reports a > b.
func (a Amount) GreaterThan(b Amount) bool { return a.Cmp(b) > 0 }

// GreaterThanOrEqual reports a >= b.
func (a Amount) GreaterThanOrEqual(b Amount) bool { return a.Cmp(b) >= 0 }

// LessThan reports a < b.
func (a Amount) LessThan(b Amount) bool { return a.Cmp(b) < 0 }

// LessThanOrEqual reports a <= b.
func (a Amount) LessThanOrEqual(b Amount) bool { return a.Cmp(b) <= 0 }

// Sign returns -1, 0 or +1.
func (a Amount) Sign() int {
	if a.big {
		return a.d.Sign()
	}
	switch {
	case a.c < 0:
		return -1
	case a.c > 0:
		return 1
	}
	return 0
}

// IsZero reports a == 0. It also makes `json:",omitzero"` omit zero amounts,
// matching the previous `omitempty` behaviour of float64 fields.
func (a Amount) IsZero() bool { return a.Sign() == 0 }

// IsPositive reports a > 0.
func (a Amount) IsPositive() bool { return a.Sign() > 0 }

// IsNegative reports a < 0.
func (a Amount) IsNegative() bool { return a.Sign() < 0 }

// IntPart returns the integer part of a.
func (a Amount) IntPart() int64 {
	if !a.big {
		switch {
		case a.e == 0:
			return a.c
		case a.e < 0:
			if -int64(a.e) > maxFastDigits {
				return 0 // |c| < 10^19
			}
			return a.c / pow10[-a.e]
		default:
			if c, ok := scaleUp(a.c, int64(a.e)); ok {
				return c
			}
		}
	}
	return a.dec().IntPart()
}

// Float64 returns the nearest float64. Use it only for display-only ratios
// or to hand a value to an API that requires a float (e.g. an LLM prompt);
// never feed the result back into money arithmetic.
func (a Amount) Float64() float64 {
	if !a.big {
		if a.e == 0 && a.c >= -(1<<53) && a.c <= 1<<53 {
			return float64(a.c)
		}
		var buf [48]byte
		// Correctly rounded, like decimal's exact rational conversion.
		if f, err := strconv.ParseFloat(string(a.appendString(buf[:0])), 64); err == nil {
			return f
		}
	}
	return a.dec().InexactFloat64()
}

// String returns the exact value without trailing zeros, e.g. "1000.5".
func (a Amount) String() string {
	if a.big {
		return a.d.String()
	}
	var buf [48]byte
	return string(a.appendString(buf[:0]))
}

// appendString appends the text of an inline value exactly like
// decimal.Decimal.String: no exponent, no trailing fractional zeros.
func (a Amount) appendString(dst []byte) []byte {
	if a.c == 0 {
		return append(dst, '0')
	}
	u := uint64(a.c)
	if a.c < 0 {
		dst = append(dst, '-')
		u = -u
	}
	var tmp [20]byte
	digits := strconv.AppendUint(tmp[:0], u, 10)
	if a.e >= 0 {
		dst = append(dst, digits...)
		for i := int32(0); i < a.e; i++ {
			dst = append(dst, '0')
		}
		return dst
	}
	frac := int(-a.e)
	if len(digits) > frac {
		intPart, fracPart := digits[:len(digits)-frac], bytes.TrimRight(digits[len(digits)-frac:], "0")
		dst = append(dst, intPart...)
		if len(fracPart) > 0 {
			dst = append(dst, '.')
			dst = append(dst, fracPart...)
		}
		return dst
	}
	dst = append(dst, '0', '.')
	for i := len(digits); i < frac; i++ {
		dst = append(dst, '0')
	}
	return append(dst, bytes.TrimRight(digits, "0")...)
}

// StringFixed returns the value rounded half-even to places digits, padded
// with zeros, e.g. "1000.50".
func (a Amount) StringFixed(places int32) string {
	r := a.Round(places)
	if r.big || places <= 0 {
		return a.dec().StringFixedBank(places)
	}
	// r has exactly `places` fractional digits (exponent -places).
	var buf [48]byte
	dst := buf[:0]
	u := uint64(r.c)
	if r.c < 0 {
		dst = append(dst, '-')
		u = -u
	}
	var tmp [20]byte
	digits := strconv.AppendUint(tmp[:0], u, 10)
	frac := int(places)
	if len(digits) > frac {
		dst = append(dst, digits[:len(digits)-frac]...)
		dst = append(dst, '.')
		dst = append(dst, digits[len(digits)-frac:]...)
	} else {
		dst = append(dst, '0', '.')
		for i := len(digits); i < frac; i++ {
			dst = append(dst, '0')
		}
		dst = append(dst, digits...)
	}
	return string(dst)
}

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

// appendText appends the exact value (String form) to dst.
func (a Amount) appendText(dst []byte) []byte {
	if a.big {
		return append(dst, a.d.String()...)
	}
	return a.appendString(dst)
}

// MarshalJSON encodes the exact value as a bare JSON number.
func (a Amount) MarshalJSON() ([]byte, error) {
	return a.appendText(make([]byte, 0, 24)), nil
}

// UnmarshalJSON accepts a JSON number (123.45) or a numeric string
// ("123.45"). JSON null leaves the amount unchanged, like it does for
// float64.
func (a *Amount) UnmarshalJSON(data []byte) error {
	b := bytes.TrimSpace(data)
	if string(b) == "null" {
		return nil
	}
	if parsed, ok := parseFast(b); ok {
		*a = parsed
		return nil
	}
	s := string(b)
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
func (a Amount) MarshalText() ([]byte, error) { return a.appendText(make([]byte, 0, 24)), nil }

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
	switch v := src.(type) {
	case nil:
		*a = Zero
		return nil
	case []byte:
		// lib/pq hands NUMERIC over as its text form.
		if parsed, ok := parseFast(v); ok {
			*a = parsed
			return nil
		}
	case string:
		if parsed, ok := parseFast(v); ok {
			*a = parsed
			return nil
		}
	case int64:
		*a = FromInt(v)
		return nil
	}
	var d decimal.Decimal
	if err := d.Scan(src); err != nil {
		return fmt.Errorf("%w: %v", ErrInvalidAmount, err)
	}
	*a = fromDec(d)
	return nil
}

// Value implements driver.Valuer. The value is sent as its exact decimal
// text, which PostgreSQL casts to the column's NUMERIC type.
func (a Amount) Value() (driver.Value, error) { return a.String(), nil }

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
