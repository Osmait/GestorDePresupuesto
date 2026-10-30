package creditcard

import (
	"testing"
	"time"
)

// The next cut/due date is computed from today in the app time zone and
// clamped to the month's last day.
func TestCalculateNextDate(t *testing.T) {
	t.Parallel()
	loc, err := time.LoadLocation("America/Santo_Domingo")
	if err != nil {
		t.Skipf("tzdata unavailable: %v", err)
	}
	noon := func(y int, m time.Month, d int) time.Time { return time.Date(y, m, d, 12, 0, 0, 0, time.UTC) }

	tests := []struct {
		name string
		day  int
		now  time.Time
		want time.Time
	}{
		{"later this month", 20, time.Date(2026, 10, 10, 9, 0, 0, 0, loc), noon(2026, 10, 20)},
		{"today counts as passed", 10, time.Date(2026, 10, 10, 9, 0, 0, 0, loc), noon(2026, 11, 10)},
		// 21:00 local on Oct 9 is Oct 10 in UTC: the cut on the 10th is still ahead
		{"late evening before the cut day", 10, time.Date(2026, 10, 9, 21, 0, 0, 0, loc), noon(2026, 10, 10)},
		{"day 31 in November is Nov 30", 31, time.Date(2026, 11, 15, 9, 0, 0, 0, loc), noon(2026, 11, 30)},
		{"day 31 next month is clamped", 31, time.Date(2026, 1, 31, 9, 0, 0, 0, loc), noon(2026, 2, 28)},
		{"December to January", 5, time.Date(2026, 12, 20, 9, 0, 0, 0, loc), noon(2027, 1, 5)},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			if got := calculateNextDate(tc.day, tc.now, loc); !got.Equal(tc.want) {
				t.Errorf("calculateNextDate(%d, %s) = %s, want %s", tc.day, tc.now, got.UTC(), tc.want)
			}
		})
	}
}
