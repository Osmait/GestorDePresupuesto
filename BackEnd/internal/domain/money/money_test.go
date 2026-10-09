package money

import (
	"database/sql/driver"
	"encoding/json"
	"errors"
	"math"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPrecision_SumOfTenthsIsExact(t *testing.T) {
	t.Parallel()

	sum := Zero
	for i := 0; i < 10; i++ {
		sum = sum.Add(MustParse("0.1"))
	}
	assert.True(t, sum.Equal(MustParse("1.00")), "got %s", sum)
	assert.Equal(t, "1.00", sum.StringFixed(2))

	// The float64 equivalent is not exact, which is the whole point.
	f := 0.0
	for i := 0; i < 10; i++ {
		f += 0.1
	}
	assert.NotEqual(t, 1.0, f)
}

func TestPrecision_LargePlusSmallIsExact(t *testing.T) {
	t.Parallel()

	got := MustParse("1e9").Add(MustParse("0.01"))
	assert.Equal(t, "1000000000.01", got.String())
	assert.True(t, got.Sub(MustParse("1000000000")).Equal(MustParse("0.01")))

	// Beyond float64's 15-16 significant digits.
	huge := MustParse("123456789012345.67").Add(MustParse("0.01"))
	assert.Equal(t, "123456789012345.68", huge.String())
}

func TestRound_HalfEven(t *testing.T) {
	t.Parallel()

	tests := []struct {
		in   string
		want string
	}{
		{"2.345", "2.34"},  // tie, round to even
		{"2.355", "2.36"},  // tie, round to even
		{"2.3451", "2.35"}, // not a tie
		{"-2.345", "-2.34"},
		{"0.005", "0.00"},
		{"0.015", "0.02"},
		{"10", "10.00"},
	}
	for _, tt := range tests {
		t.Run(tt.in, func(t *testing.T) {
			t.Parallel()
			assert.Equal(t, tt.want, MustParse(tt.in).RoundCents().StringFixed(2))
		})
	}
}

func TestDivision_RoundedOnceAtTheEnd(t *testing.T) {
	t.Parallel()

	// 100 / 3 = 33.333... -> 33.33; three of them leave a 0.01 remainder.
	third := FromInt(100).DivInt(3).RoundCents()
	assert.Equal(t, "33.33", third.String())
	assert.Equal(t, "0.01", FromInt(100).Sub(third.MulInt(3)).String())

	// 2/3 rounds up, 1/8 = 0.125 is a tie and rounds to even.
	assert.Equal(t, "0.67", FromInt(2).DivInt(3).RoundCents().String())
	assert.Equal(t, "0.12", FromInt(1).DivInt(8).RoundCents().String())

	assert.True(t, FromInt(5).DivOrZero(Zero).IsZero())
	assert.Panics(t, func() { FromInt(5).Div(Zero) })
}

func TestPercent(t *testing.T) {
	t.Parallel()

	assert.Equal(t, 28.65, Percent(FromInt(27790), FromInt(97000)))
	assert.Equal(t, 33.33, Percent(FromInt(1), FromInt(3)))
	assert.Equal(t, 150.0, Percent(FromInt(150), FromInt(100)))
	assert.Equal(t, 0.0, Percent(FromInt(5), Zero))
}

func TestMinMaxSum(t *testing.T) {
	t.Parallel()

	a, b, c := MustParse("1.5"), MustParse("-2"), MustParse("3.25")
	assert.True(t, Min(a, b, c).Equal(b))
	assert.True(t, Max(a, b, c).Equal(c))
	assert.True(t, Sum(a, b, c).Equal(MustParse("2.75")))
	assert.True(t, Sum().IsZero())
}

func TestFromExternalFloat(t *testing.T) {
	t.Parallel()

	got, err := FromExternalFloat(0.1+0.2, CentsScale)
	require.NoError(t, err)
	assert.Equal(t, "0.3", got.String())

	got, err = FromExternalFloat(58.123456789123, RateScale)
	require.NoError(t, err)
	assert.Equal(t, "58.1234567891", got.String())

	for _, f := range []float64{math.NaN(), math.Inf(1), math.Inf(-1)} {
		_, err := FromExternalFloat(f, CentsScale)
		assert.ErrorIs(t, err, ErrInvalidAmount)
	}
}

func TestParse_RejectsInvalidAndOutOfRange(t *testing.T) {
	t.Parallel()

	for _, in := range []string{"", "  ", "abc", "1,000.00", "1e999999999", "1e-999", "NaN"} {
		_, err := Parse(in)
		assert.ErrorIs(t, err, ErrInvalidAmount, in)
	}
	got, err := Parse(" 1e3 ")
	require.NoError(t, err)
	assert.Equal(t, "1000", got.String())
}

// --- JSON -------------------------------------------------------------------

type payload struct {
	Amount   Amount     `json:"amount"`
	Optional NullAmount `json:"optional"`
	Omitted  Amount     `json:"omitted,omitzero"`
	Ptr      *Amount    `json:"ptr,omitempty"`
}

func TestJSON_MarshalsAsBareNumbers(t *testing.T) {
	t.Parallel()

	ptr := MustParse("-0.5")
	out, err := json.Marshal(payload{
		Amount:   MustParse("1250.7500"), // DECIMAL(19,4) as scanned from Postgres
		Optional: NewNullAmount(MustParse("0.00001234")),
		Ptr:      &ptr,
	})
	require.NoError(t, err)
	assert.JSONEq(t, `{"amount":1250.75,"optional":0.00001234,"ptr":-0.5}`, string(out))
	assert.Equal(t, `{"amount":1250.75,"optional":0.00001234,"ptr":-0.5}`, string(out))

	// A generic client (TypeScript number / Swift Double) sees JSON numbers.
	var generic map[string]any
	require.NoError(t, json.Unmarshal(out, &generic))
	assert.IsType(t, float64(0), generic["amount"])
	assert.Equal(t, 1250.75, generic["amount"])

	out, err = json.Marshal(payload{})
	require.NoError(t, err)
	assert.Equal(t, `{"amount":0,"optional":null}`, string(out))
}

func TestJSON_MatchesFloat64Encoding(t *testing.T) {
	t.Parallel()

	// For the values the API produces, Amount encodes byte-for-byte like
	// float64 did, so no client can notice the change.
	for _, v := range []string{"0", "1", "-1", "100", "1000.5", "0.01", "125.5", "60.25", "999999999.99", "0.1234"} {
		f := MustParse(v).Float64()
		want, err := json.Marshal(f)
		require.NoError(t, err)
		got, err := json.Marshal(MustParse(v))
		require.NoError(t, err)
		assert.Equal(t, string(want), string(got), v)
	}
}

func TestJSON_UnmarshalAcceptsNumbersAndNumericStrings(t *testing.T) {
	t.Parallel()

	var p payload
	require.NoError(t, json.Unmarshal([]byte(`{"amount":125.50,"optional":"7.25","ptr":null}`), &p))
	assert.True(t, p.Amount.Equal(MustParse("125.5")))
	assert.True(t, p.Optional.Valid)
	assert.True(t, p.Optional.Amount.Equal(MustParse("7.25")))
	assert.Nil(t, p.Ptr)

	require.NoError(t, json.Unmarshal([]byte(`{"amount":"0.1","optional":null}`), &p))
	assert.Equal(t, "0.1", p.Amount.String())
	assert.False(t, p.Optional.Valid)

	// Exactness: a value float64 cannot hold is preserved.
	require.NoError(t, json.Unmarshal([]byte(`{"amount":12345678901234567.89}`), &p))
	assert.Equal(t, "12345678901234567.89", p.Amount.String())

	for _, bad := range []string{`{"amount":"abc"}`, `{"amount":true}`, `{"amount":""}`, `{"amount":[1]}`, `{"amount":"1e999999"}`} {
		assert.Error(t, json.Unmarshal([]byte(bad), &p), bad)
	}
}

func TestJSON_RoundTrip(t *testing.T) {
	t.Parallel()

	for _, v := range []string{"0", "0.1", "-12.34", "1000000000.01", "0.000000000000000001", "25000000000.123456789012345678"} {
		in := MustParse(v)
		data, err := json.Marshal(in)
		require.NoError(t, err)
		var out Amount
		require.NoError(t, json.Unmarshal(data, &out))
		assert.True(t, in.Equal(out), "%s -> %s -> %s", v, data, out)
	}
}

func TestText_AndParam(t *testing.T) {
	t.Parallel()

	var a Amount
	require.NoError(t, a.UnmarshalParam("99.95"))
	assert.Equal(t, "99.95", a.String())
	require.Error(t, a.UnmarshalText([]byte("x")))
	txt, err := MustParse("1.10").MarshalText()
	require.NoError(t, err)
	assert.Equal(t, "1.1", string(txt))
}

// --- SQL --------------------------------------------------------------------

func TestSQL_ScanAndValue(t *testing.T) {
	t.Parallel()

	var a Amount
	for _, src := range []any{[]byte("1234.5600"), "1234.56", int64(5), 2.5} {
		require.NoError(t, a.Scan(src))
	}
	assert.Equal(t, "2.5", a.String())

	require.NoError(t, a.Scan([]byte("1234.5600")))
	v, err := a.Value()
	require.NoError(t, err)
	assert.Equal(t, driver.Value("1234.56"), v)

	require.NoError(t, a.Scan(nil))
	assert.True(t, a.IsZero())
	assert.Error(t, a.Scan([]byte("not a number")))

	var n NullAmount
	require.NoError(t, n.Scan(nil))
	assert.False(t, n.Valid)
	v, err = n.Value()
	require.NoError(t, err)
	assert.Nil(t, v)
	assert.Nil(t, n.Ptr())
	assert.True(t, n.OrZero().IsZero())

	require.NoError(t, n.Scan([]byte("15.00")))
	assert.True(t, n.Valid)
	v, err = n.Value()
	require.NoError(t, err)
	assert.Equal(t, driver.Value("15"), v)
	require.NotNil(t, n.Ptr())
	assert.True(t, NullAmountFromPtr(n.Ptr()).Valid)
	assert.False(t, NullAmountFromPtr(nil).Valid)
}

func TestErrInvalidAmountIsWrapped(t *testing.T) {
	t.Parallel()
	_, err := Parse("x")
	assert.True(t, errors.Is(err, ErrInvalidAmount))
}

func TestHasMaxScale(t *testing.T) {
	t.Parallel()

	cases := []struct {
		in   string
		want bool
	}{
		{"0", true},
		{"10", true},
		{"0.1", true},
		{"0.01", true},
		{"1.500", true}, // trailing zeros are not significant
		{"-12.34", true},
		{"0.001", false},
		{"1.005", false},
		{"-0.009", false},
		{"123456789.123", false},
	}
	for _, tc := range cases {
		assert.Equal(t, tc.want, MustParse(tc.in).HasMaxScale(2), tc.in)
	}
}

func TestCheckCents(t *testing.T) {
	t.Parallel()

	require.NoError(t, CheckCents("amount", MustParse("19.99")))

	err := CheckCents("amount", MustParse("0.001"))
	require.Error(t, err)
	assert.True(t, errors.Is(err, ErrTooManyDecimals))
	assert.Contains(t, err.Error(), "amount must have at most 2 decimal places")
}
