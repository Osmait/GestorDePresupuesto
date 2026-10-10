package recurring_transaction

import (
	"testing"
	"time"
)

func d(y int, m time.Month, day int) time.Time {
	return time.Date(y, m, day, 0, 0, 0, 0, time.UTC)
}

func TestNextOccurrenceAfter_ClampsToMonthEnd(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name       string
		occurrence time.Time
		day        int
		want       time.Time
	}{
		{"jan31 to feb28 non-leap", d(2026, time.January, 31), 31, d(2026, time.February, 28)},
		{"jan31 to feb29 leap", d(2028, time.January, 31), 31, d(2028, time.February, 29)},
		{"feb28 back to mar31", d(2026, time.February, 28), 31, d(2026, time.March, 31)},
		{"mar31 to apr30", d(2026, time.March, 31), 31, d(2026, time.April, 30)},
		{"jan30 to feb28", d(2026, time.January, 30), 30, d(2026, time.February, 28)},
		{"jan29 to feb29 leap", d(2028, time.January, 29), 29, d(2028, time.February, 29)},
		{"dec15 to jan15 next year", d(2026, time.December, 15), 15, d(2027, time.January, 15)},
		{"dec31 to jan31", d(2026, time.December, 31), 31, d(2027, time.January, 31)},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			if got := NextOccurrenceAfter(tt.occurrence, tt.day); !got.Equal(tt.want) {
				t.Fatalf("NextOccurrenceAfter(%s, %d) = %s, want %s", tt.occurrence.Format(time.DateOnly), tt.day, got.Format(time.DateOnly), tt.want.Format(time.DateOnly))
			}
		})
	}
}

func TestFirstOccurrenceOnOrAfter(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name  string
		today time.Time
		day   int
		want  time.Time
	}{
		{"same day", d(2026, time.October, 8), 8, d(2026, time.October, 8)},
		{"later this month", d(2026, time.October, 8), 20, d(2026, time.October, 20)},
		{"already passed -> next month", d(2026, time.October, 8), 5, d(2026, time.November, 5)},
		{"day 31 in february clamps", d(2026, time.February, 10), 31, d(2026, time.February, 28)},
		{"day 30 in leap february clamps", d(2028, time.February, 1), 30, d(2028, time.February, 29)},
		{"clamped day equals today", d(2026, time.April, 30), 31, d(2026, time.April, 30)},
		{"year rollover", d(2026, time.December, 20), 1, d(2027, time.January, 1)},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			if got := FirstOccurrenceOnOrAfter(tt.today, tt.day); !got.Equal(tt.want) {
				t.Fatalf("got %s, want %s", got.Format(time.DateOnly), tt.want.Format(time.DateOnly))
			}
		})
	}
}

func TestDateIn_TimeZoneBoundary(t *testing.T) {
	t.Parallel()
	loc, err := time.LoadLocation("America/Santo_Domingo") // UTC-4, no DST
	if err != nil {
		t.Skipf("tzdata not available: %v", err)
	}
	tests := []struct {
		name    string
		instant time.Time
		want    time.Time
	}{
		{"before local midnight", time.Date(2026, time.March, 1, 3, 30, 0, 0, time.UTC), d(2026, time.February, 28)},
		{"after local midnight", time.Date(2026, time.March, 1, 4, 30, 0, 0, time.UTC), d(2026, time.March, 1)},
		{"utc evening is same local day", time.Date(2026, time.March, 1, 23, 0, 0, 0, time.UTC), d(2026, time.March, 1)},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			if got := DateIn(tt.instant, loc); !got.Equal(tt.want) {
				t.Fatalf("DateIn(%s) = %s, want %s", tt.instant, got.Format(time.DateOnly), tt.want.Format(time.DateOnly))
			}
		})
	}
}

func TestRescheduleOnDayChange(t *testing.T) {
	t.Parallel()
	today := d(2026, time.October, 8)
	nov5 := d(2026, time.November, 5)
	oct25 := d(2026, time.October, 25)
	sep5 := d(2026, time.September, 5)
	tests := []struct {
		name    string
		current *time.Time
		day     int
		want    time.Time
	}{
		{"this month already executed keeps next month", &nov5, 20, d(2026, time.November, 20)},
		{"not yet executed moves within month", &oct25, 15, d(2026, time.October, 15)},
		{"not yet executed and new day passed", &oct25, 3, d(2026, time.November, 3)},
		{"overdue schedule restarts from today", &sep5, 10, d(2026, time.October, 10)},
		{"no schedule", nil, 31, d(2026, time.October, 31)},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			if got := RescheduleOnDayChange(today, tt.current, tt.day); !got.Equal(tt.want) {
				t.Fatalf("got %s, want %s", got.Format(time.DateOnly), tt.want.Format(time.DateOnly))
			}
		})
	}
}

func TestValidateDayOfMonth(t *testing.T) {
	t.Parallel()
	for _, day := range []int{1, 15, 31} {
		if err := ValidateDayOfMonth(day); err != nil {
			t.Fatalf("day %d: unexpected error %v", day, err)
		}
	}
	for _, day := range []int{0, -1, 32} {
		if err := ValidateDayOfMonth(day); err == nil {
			t.Fatalf("day %d: expected error", day)
		}
	}
}
