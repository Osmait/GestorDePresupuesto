package money

// Differential tests: the inline (int64) fast paths must give exactly what
// shopspring/decimal gives — same text, same rounding, same coefficient and
// exponent — including around the int64 overflow boundaries.

import (
	"encoding/json"
	"math"
	"math/rand/v2"
	"strconv"
	"testing"

	"github.com/shopspring/decimal"
)

func sameRepr(t *testing.T, op string, got Amount, want decimal.Decimal) {
	t.Helper()
	g := got.Decimal()
	if g.Exponent() != want.Exponent() || g.Coefficient().Cmp(want.Coefficient()) != 0 {
		t.Fatalf("%s: got %s (coef %s exp %d), want %s (coef %s exp %d)",
			op, got, g.Coefficient(), g.Exponent(), want, want.Coefficient(), want.Exponent())
	}
	if got.String() != want.String() {
		t.Fatalf("%s: String %q, want %q", op, got.String(), want.String())
	}
	if want.Coefficient().IsInt64() == got.big {
		t.Fatalf("%s: inline form not canonical (big=%v) for %s", op, got.big, want)
	}
}

func equivalenceInputs(r *rand.Rand, n int) []string {
	fixed := []string{
		"0", "-0", "0.00", "1", "-1", "0.5", "-0.5", "1.5", "2.5", "-2.5", "0.005", "0.015", "0.025",
		"-0.015", "1234.5600", "100", "1e3", "-1.5E-3", "12345678901234567.89", "999999999999999999",
		"-999999999999999999", "9223372036854775807", "-9223372036854775808", "9223372036854775808",
		"0.000000000000000001", "123456789.123456789", "92233720368547758.07", "1.", "00012.3400",
		"98765432109876543210.123456789", "0.1", "0.2", "0.3", "7.77", "60.1234567890",
	}
	out := append([]string(nil), fixed...)
	for range n {
		digits := 1 + r.IntN(20)
		b := make([]byte, 0, digits+3)
		if r.IntN(3) == 0 {
			b = append(b, '-')
		}
		point := -1
		if r.IntN(4) != 0 {
			point = r.IntN(digits)
		}
		for i := range digits {
			if i == point && i > 0 {
				b = append(b, '.')
			}
			b = append(b, byte('0'+r.IntN(10)))
		}
		out = append(out, string(b))
	}
	return out
}

func TestEquivalence_WithDecimal(t *testing.T) {
	r := rand.New(rand.NewPCG(1, 2))
	inputs := equivalenceInputs(r, 400)
	amounts := make([]Amount, 0, len(inputs))
	decs := make([]decimal.Decimal, 0, len(inputs))
	for _, s := range inputs {
		a, err := Parse(s)
		d, derr := decimal.NewFromString(s)
		if (err != nil) != (derr != nil) {
			t.Fatalf("Parse(%q) err=%v, decimal err=%v", s, err, derr)
		}
		if err != nil {
			continue
		}
		sameRepr(t, "Parse "+s, a, d)

		var scanned Amount
		if err := scanned.Scan([]byte(s)); err != nil {
			t.Fatalf("Scan(%q): %v", s, err)
		}
		sameRepr(t, "Scan "+s, scanned, d)

		var fromJSON Amount
		if err := json.Unmarshal([]byte(strconv.Quote(s)), &fromJSON); err != nil {
			t.Fatalf("Unmarshal(%q): %v", s, err)
		}
		sameRepr(t, "UnmarshalJSON string "+s, fromJSON, d)
		if json.Valid([]byte(s)) {
			var bare Amount
			if err := json.Unmarshal([]byte(s), &bare); err != nil {
				t.Fatalf("Unmarshal(%s): %v", s, err)
			}
			sameRepr(t, "UnmarshalJSON number "+s, bare, d)
		}

		js, _ := json.Marshal(a)
		if string(js) != d.String() {
			t.Fatalf("MarshalJSON(%s) = %s, want %s", s, js, d.String())
		}
		if a.Sign() != d.Sign() || a.IntPart() != d.IntPart() && d.Abs().LessThan(decimal.New(1, 18)) {
			t.Fatalf("Sign/IntPart(%s): %d/%d want %d/%d", s, a.Sign(), a.IntPart(), d.Sign(), d.IntPart())
		}
		if f := a.Float64(); f != d.InexactFloat64() {
			t.Fatalf("Float64(%s) = %v, want %v", s, f, d.InexactFloat64())
		}
		sameRepr(t, "Neg "+s, a.Neg(), d.Neg())
		sameRepr(t, "Abs "+s, a.Abs(), d.Abs())
		for places := int32(-3); places <= 12; places++ {
			sameRepr(t, "Round "+s+" "+strconv.Itoa(int(places)), a.Round(places), d.RoundBank(places))
			if got, want := a.StringFixed(places), d.StringFixedBank(places); got != want {
				t.Fatalf("StringFixed(%s, %d) = %q, want %q", s, places, got, want)
			}
			if places >= 0 {
				if got, want := a.HasMaxScale(places), d.Equal(d.Truncate(places)); got != want {
					t.Fatalf("HasMaxScale(%s, %d) = %v, want %v", s, places, got, want)
				}
			}
		}
		amounts = append(amounts, a)
		decs = append(decs, d)
	}

	for i := range amounts {
		for k := range 12 {
			j := (i*7 + k*13) % len(amounts)
			a, b := amounts[i], amounts[j]
			da, db := decs[i], decs[j]
			sameRepr(t, a.String()+" + "+b.String(), a.Add(b), da.Add(db))
			sameRepr(t, a.String()+" - "+b.String(), a.Sub(b), da.Sub(db))
			sameRepr(t, a.String()+" * "+b.String(), a.Mul(b), da.Mul(db))
			if got, want := a.Cmp(b), da.Cmp(db); got != want {
				t.Fatalf("Cmp(%s, %s) = %d, want %d", a, b, got, want)
			}
			if !db.IsZero() {
				sameRepr(t, a.String()+" / "+b.String(), a.Div(b), da.DivRound(db, DivisionScale))
			}
		}
	}
}

func TestEquivalence_OverflowBoundaries(t *testing.T) {
	maxA, minA := New(math.MaxInt64, 0), New(math.MinInt64, 0)
	maxD, minD := decimal.New(math.MaxInt64, 0), decimal.New(math.MinInt64, 0)
	one := decimal.New(1, 0)
	sameRepr(t, "max+1", maxA.Add(FromInt(1)), maxD.Add(one))
	sameRepr(t, "min-1", minA.Sub(FromInt(1)), minD.Sub(one))
	sameRepr(t, "-min", minA.Neg(), minD.Neg())
	sameRepr(t, "|min|", minA.Abs(), minD.Abs())
	sameRepr(t, "min*-1", minA.Mul(FromInt(-1)), minD.Mul(decimal.New(-1, 0)))
	sameRepr(t, "max*max", maxA.Mul(maxA), maxD.Mul(maxD))
	sameRepr(t, "max+0.1", maxA.Add(New(1, -1)), maxD.Add(decimal.New(1, -1)))
	sameRepr(t, "max round 2", maxA.Round(2), maxD.RoundBank(2))
	sameRepr(t, "min round 2", minA.Round(2), minD.RoundBank(2))
	sameRepr(t, "max-(-1)", maxA.Sub(FromInt(-1)), maxD.Sub(decimal.New(-1, 0)))
	sameRepr(t, "0-min", Zero.Sub(minA), decimal.Zero.Sub(minD))
	sameRepr(t, "e mismatch", New(1, 30).Add(New(1, -30)), decimal.New(1, 30).Add(decimal.New(1, -30)))
	if got := New(math.MaxInt64, -2).String(); got != decimal.New(math.MaxInt64, -2).String() {
		t.Fatalf("String = %s", got)
	}
	if got, want := New(5, 3).IntPart(), decimal.New(5, 3).IntPart(); got != want {
		t.Fatalf("IntPart = %d, want %d", got, want)
	}
	if got, want := New(123, -25).IntPart(), int64(0); got != want {
		t.Fatalf("IntPart = %d, want %d", got, want)
	}
}

func TestEquivalence_ScanDriverTypes(t *testing.T) {
	for _, src := range []any{int64(42), float64(12.75), "19.99", []byte(`"3.50"`), uint64(7)} {
		var a Amount
		if err := a.Scan(src); err != nil {
			t.Fatalf("Scan(%v): %v", src, err)
		}
		var d decimal.Decimal
		if err := d.Scan(src); err != nil {
			t.Fatalf("decimal.Scan(%v): %v", src, err)
		}
		sameRepr(t, "Scan", a, d)
	}
}

func FuzzEquivalence(f *testing.F) {
	for _, s := range []string{"0", "1.25", "-0.005", "9223372036854775807", "1e5", "12.3400"} {
		f.Add(s, "2.5", int8(2))
	}
	f.Fuzz(func(t *testing.T, x, y string, places int8) {
		a, err := Parse(x)
		if err != nil {
			return
		}
		b, err := Parse(y)
		if err != nil {
			return
		}
		da, db := a.Decimal(), b.Decimal()
		p := int32(places % 20)
		sameRepr(t, "add", a.Add(b), da.Add(db))
		sameRepr(t, "sub", a.Sub(b), da.Sub(db))
		sameRepr(t, "mul", a.Mul(b), da.Mul(db))
		sameRepr(t, "round", a.Round(p), da.RoundBank(p))
		if a.StringFixed(p) != da.StringFixedBank(p) {
			t.Fatalf("StringFixed(%s, %d)", x, p)
		}
		if a.Cmp(b) != da.Cmp(db) {
			t.Fatalf("Cmp(%s, %s)", x, y)
		}
	})
}
