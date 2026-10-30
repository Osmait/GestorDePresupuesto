package mcp

import (
	"testing"
	"time"
)

// Periods are calendar periods of the app time zone. On Oct 31 the previous
// month is September (AddDate(0, -1, 0) gave "Sep 31" = Oct 1), also late in
// the evening when UTC is already in November.
func TestResolvePeriodRange(t *testing.T) {
	t.Parallel()
	loc, err := time.LoadLocation("America/Santo_Domingo")
	if err != nil {
		t.Skipf("tzdata unavailable: %v", err)
	}

	tests := []struct {
		name             string
		period           string
		dateFrom, dateTo string
		now              time.Time
		from, to         string
		wantErr          bool
	}{
		{name: "this_month on Oct 31 22:00 local", period: "this_month", now: time.Date(2026, 10, 31, 22, 0, 0, 0, loc), from: "2026-10-01", to: "2026-10-31"},
		{name: "default is this_month", period: "", now: time.Date(2026, 10, 31, 22, 0, 0, 0, loc), from: "2026-10-01", to: "2026-10-31"},
		{name: "last_month on Oct 31", period: "last_month", now: time.Date(2026, 10, 31, 12, 0, 0, 0, loc), from: "2026-09-01", to: "2026-09-30"},
		{name: "last_month on Oct 31 22:00 local", period: "last_month", now: time.Date(2026, 10, 31, 22, 0, 0, 0, loc), from: "2026-09-01", to: "2026-09-30"},
		{name: "last_month on Mar 31", period: "last_month", now: time.Date(2026, 3, 31, 12, 0, 0, 0, loc), from: "2026-02-01", to: "2026-02-28"},
		{name: "last_month on Jan 31", period: "last_month", now: time.Date(2026, 1, 31, 12, 0, 0, 0, loc), from: "2025-12-01", to: "2025-12-31"},
		{name: "this_week", period: "this_week", now: time.Date(2026, 10, 31, 22, 0, 0, 0, loc), from: "2026-10-26", to: "2026-11-01"},
		{name: "this_year", period: "this_year", now: time.Date(2026, 12, 31, 22, 0, 0, 0, loc), from: "2026-01-01", to: "2026-12-31"},
		{name: "custom", period: "custom", dateFrom: "2026-10-01", dateTo: "2026-10-31", now: time.Now(), from: "2026-10-01", to: "2026-10-31"},
		{name: "custom without dates", period: "custom", now: time.Now(), wantErr: true},
		{name: "unknown", period: "fortnight", now: time.Now(), wantErr: true},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			from, to, err := resolvePeriodRange(tc.period, tc.dateFrom, tc.dateTo, tc.now, loc)
			if tc.wantErr {
				if err == nil {
					t.Fatal("expected an error")
				}
				return
			}
			if err != nil {
				t.Fatal(err)
			}
			if got := from.Format("2006-01-02"); got != tc.from {
				t.Errorf("from = %s, want %s", got, tc.from)
			}
			if got := to.Format("2006-01-02"); got != tc.to {
				t.Errorf("to = %s, want %s", got, tc.to)
			}
			if from.Location() != loc || to.Location() != loc {
				t.Errorf("bounds not in the app location: %s / %s", from.Location(), to.Location())
			}
		})
	}
}
