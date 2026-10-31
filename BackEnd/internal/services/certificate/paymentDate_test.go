package certificate

import (
	"testing"
	"time"
)

// Payment dates are cut days at 12:00 UTC (the same day in Santo Domingo).
// from is a previous payment date (legacy ones were stored at 00:00 UTC, new
// ones at 12:00 UTC) or the certificate's created_at instant.
func TestCalculateNextPaymentDate(t *testing.T) {
	t.Parallel()
	loc, err := time.LoadLocation("America/Santo_Domingo")
	if err != nil {
		t.Skipf("tzdata unavailable: %v", err)
	}
	s := NewCertificateService(nil, nil, nil, WithLocation(loc))
	noon := func(y int, m time.Month, d int) time.Time { return time.Date(y, m, d, 12, 0, 0, 0, time.UTC) }

	tests := []struct {
		name   string
		from   time.Time
		cutDay int
		want   time.Time
	}{
		{"legacy payment at 00:00 UTC on the cut day", time.Date(2026, 10, 5, 0, 0, 0, 0, time.UTC), 5, noon(2026, 11, 5)},
		{"payment at 12:00 UTC on the cut day", noon(2026, 10, 5), 5, noon(2026, 11, 5)},
		{"created on Oct 4 at 21:00 local (Oct 5 in UTC)", time.Date(2026, 10, 4, 21, 0, 0, 0, loc), 5, noon(2026, 10, 5)},
		{"cut day 31 in November", noon(2026, 10, 31), 31, noon(2026, 11, 30)},
		{"December to January", noon(2026, 12, 15), 10, noon(2027, 1, 10)},
		// A payment on a clamped cut day must still move on (it used to
		// return itself, so the payment loop never ended).
		{"cut day 31 from the clamped Nov 30", noon(2026, 11, 30), 31, noon(2026, 12, 31)},
		{"cut day 31 from the clamped Sep 30", noon(2026, 9, 30), 31, noon(2026, 10, 31)},
		{"cut day 30 from the clamped Feb 28", noon(2027, 2, 28), 30, noon(2027, 3, 30)},
		{"cut day 29 from Feb 28 in a leap year", noon(2028, 2, 28), 29, noon(2028, 2, 29)},
		{"cut day 31 from the 15th of a short month", noon(2026, 9, 15), 31, noon(2026, 9, 30)},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			if got := s.calculateNextPaymentDate(tc.from, tc.cutDay); !got.Equal(tc.want) {
				t.Errorf("next payment = %s, want %s", got.UTC(), tc.want)
			}
		})
	}

	// Every cut day advances through a whole leap and non-leap year.
	for cutDay := 1; cutDay <= 31; cutDay++ {
		from := noon(2027, 1, 1)
		for i := 0; i < 26; i++ {
			next := s.calculateNextPaymentDate(from, cutDay)
			if !next.After(from) {
				t.Fatalf("cut day %d: next payment %s does not advance from %s", cutDay, next, from)
			}
			from = next
		}
	}

	maturity := time.Date(2026, 11, 5, 0, 0, 0, 0, time.UTC) // stored at 00:00 UTC
	if s.afterMaturity(noon(2026, 11, 5), &maturity) {
		t.Error("a payment on the maturity day is not after it")
	}
	if !s.afterMaturity(noon(2026, 11, 6), &maturity) {
		t.Error("a payment the day after the maturity day is after it")
	}
	if s.afterMaturity(noon(2030, 1, 1), nil) {
		t.Error("no maturity date: never after it")
	}
}
