package money_test

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money/moneytest"
)

func TestNormalizeCurrency(t *testing.T) {
	t.Parallel()
	tests := []struct{ in, def, want string }{
		{" usd ", "DOP", "USD"},
		{"", "USD", "USD"},
		{"   ", "DOP", "DOP"},
		{"eur", "DOP", "EUR"},
	}
	for _, tt := range tests {
		assert.Equal(t, tt.want, money.NormalizeCurrency(tt.in, tt.def), tt.in)
	}
	assert.True(t, money.IsSupportedCurrency("DOP"))
	assert.True(t, money.IsSupportedCurrency("USD"))
	assert.False(t, money.IsSupportedCurrency("EUR"))
	assert.False(t, money.IsSupportedCurrency("usd"))
}

func TestToDOPAndConvert(t *testing.T) {
	t.Parallel()
	rate := money.MustParse("58.5")
	tests := []struct {
		name     string
		amount   string
		from, to string
		rate     money.Amount
		want     string
		ok       bool
	}{
		{"same currency", "100", "DOP", "DOP", rate, "100", true},
		{"usd to dop multiplies", "10", "USD", "DOP", rate, "585", true},
		{"dop to usd divides", "585", "DOP", "USD", rate, "10", true},
		{"unsupported currency", "1", "EUR", "DOP", rate, "0", false},
		{"no rate", "1", "USD", "DOP", money.Zero, "0", false},
		{"same currency needs no rate", "7", "USD", "USD", money.Zero, "7", true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			got, ok := money.Convert(money.MustParse(tt.amount), tt.from, tt.to, tt.rate)
			assert.Equal(t, tt.ok, ok)
			moneytest.Equal(t, tt.want, got)
		})
	}

	dop, ok := money.ToDOP(money.FromInt(2), "USD", rate)
	assert.True(t, ok)
	moneytest.Equal(t, "117", dop)
	dop, ok = money.ToDOP(money.FromInt(2), "DOP", rate)
	assert.True(t, ok)
	moneytest.Equal(t, "2", dop)
	_, ok = money.ToDOP(money.FromInt(2), "", rate)
	assert.False(t, ok)
}
