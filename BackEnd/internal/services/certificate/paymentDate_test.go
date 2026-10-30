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
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			if got := s.calculateNextPaymentDate(tc.from, tc.cutDay); !got.Equal(tc.want) {
				t.Errorf("next payment = %s, want %s", got.UTC(), tc.want)
			}
		})
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
