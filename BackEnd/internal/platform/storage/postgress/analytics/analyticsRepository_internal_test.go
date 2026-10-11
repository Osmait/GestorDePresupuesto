package postgress

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"

	"github.com/osmait/gestorDePresupuesto/internal/domain/money"
	"github.com/osmait/gestorDePresupuesto/internal/domain/money/moneytest"
)

// The ranged queries take a half-open range [from, to): the whole months read
// from the rollup are those that end at or before to.
func TestWholeMonths_HalfOpenRange(t *testing.T) {
	t.Parallel()

	utc := func(y int, m time.Month, d int, h int) time.Time { return time.Date(y, m, d, h, 0, 0, 0, time.UTC) }
	tests := []struct {
		name               string
		from, to           time.Time
		wantStart, wantEnd time.Time
		wantOK             bool
	}{
		{"one whole month (date_to = its last day)", utc(2025, 1, 1, 0), utc(2025, 2, 1, 0), utc(2025, 1, 1, 0), utc(2025, 2, 1, 0), true},
		{"two whole months", utc(2025, 1, 1, 0), utc(2025, 3, 1, 0), utc(2025, 1, 1, 0), utc(2025, 3, 1, 0), true},
		{"whole year", utc(2024, 1, 1, 0), utc(2025, 1, 1, 0), utc(2024, 1, 1, 0), utc(2025, 1, 1, 0), true},
		{"partial edges around a whole month", utc(2025, 1, 15, 0), utc(2025, 3, 10, 0), utc(2025, 2, 1, 0), utc(2025, 3, 1, 0), true},
		{"month minus its last day", utc(2025, 1, 1, 0), utc(2025, 1, 31, 0), time.Time{}, time.Time{}, false},
		{"single day", utc(2025, 1, 31, 0), utc(2025, 2, 1, 0), time.Time{}, time.Time{}, false},
		{"starts after 00:00 of the 1st", utc(2025, 1, 1, 4), utc(2025, 2, 1, 0), time.Time{}, time.Time{}, false},
		{"non-UTC bounds are compared in UTC", time.Date(2025, 1, 1, 0, 0, 0, 0, time.FixedZone("AST", -4*3600)), utc(2025, 3, 1, 0), utc(2025, 2, 1, 0), utc(2025, 3, 1, 0), true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			start, end, ok := wholeMonths(tt.from, tt.to)
			assert.Equal(t, tt.wantOK, ok)
			if tt.wantOK {
				assert.True(t, start.Equal(tt.wantStart), "start: want %s got %s", tt.wantStart, start)
				assert.True(t, end.Equal(tt.wantEnd), "end: want %s got %s", tt.wantEnd, end)
			}
		})
	}
}

// Every aggregate falls back to the same rate (60, like
// AnalyticsService.resolveUsdToDop) when the rate is not positive.
func TestRateOrFallback(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name string
		rate money.Amount
		want string
	}{
		{"positive rate is kept", money.MustParse("58.75"), "58.75"},
		{"zero falls back to 60", money.Zero, "60"},
		{"negative falls back to 60", money.FromInt(-5), "60"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			moneytest.Equal(t, tt.want, rateOrFallback(tt.rate))
		})
	}
}
