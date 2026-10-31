package apptime

import (
	"testing"
	"time"
)

func santoDomingo(t *testing.T) *time.Location {
	t.Helper()
	loc, err := time.LoadLocation(DefaultTimezone)
	if err != nil {
		t.Fatalf("load %s: %v", DefaultTimezone, err)
	}
	return loc
}

func mustInstant(t *testing.T, s string) time.Time {
	t.Helper()
	v, err := time.Parse(time.RFC3339, s)
	if err != nil {
		t.Fatal(err)
	}
	return v
}

func TestDayAndMonthBounds(t *testing.T) {
	t.Parallel()
	loc := santoDomingo(t)

	tests := []struct {
		name     string
		at       string
		day      string
		nextDay  string
		month    string
		nextMon  string
		prevMon  string
		weekFrom string
	}{
		{
			name:     "Oct 31 21:30 local is Nov 1 in UTC",
			at:       "2026-11-01T01:30:00Z",
			day:      "2026-10-31T04:00:00Z",
			nextDay:  "2026-11-01T04:00:00Z",
			month:    "2026-10-01T04:00:00Z",
			nextMon:  "2026-11-01T04:00:00Z",
			prevMon:  "2026-09-01T04:00:00Z",
			weekFrom: "2026-10-26T04:00:00Z",
		},
		{
			name:     "Sep 30 23:30 local",
			at:       "2026-10-01T03:30:00Z",
			day:      "2026-09-30T04:00:00Z",
			nextDay:  "2026-10-01T04:00:00Z",
			month:    "2026-09-01T04:00:00Z",
			nextMon:  "2026-10-01T04:00:00Z",
			prevMon:  "2026-08-01T04:00:00Z",
			weekFrom: "2026-09-28T04:00:00Z",
		},
		{
			name:     "exactly local midnight of Nov 1",
			at:       "2026-11-01T04:00:00Z",
			day:      "2026-11-01T04:00:00Z",
			nextDay:  "2026-11-02T04:00:00Z",
			month:    "2026-11-01T04:00:00Z",
			nextMon:  "2026-12-01T04:00:00Z",
			prevMon:  "2026-10-01T04:00:00Z",
			weekFrom: "2026-10-26T04:00:00Z",
		},
		{
			name:     "new year's eve 22:00 local",
			at:       "2027-01-01T02:00:00Z",
			day:      "2026-12-31T04:00:00Z",
			nextDay:  "2027-01-01T04:00:00Z",
			month:    "2026-12-01T04:00:00Z",
			nextMon:  "2027-01-01T04:00:00Z",
			prevMon:  "2026-11-01T04:00:00Z",
			weekFrom: "2026-12-28T04:00:00Z",
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			at := mustInstant(t, tc.at)
			for _, c := range []struct {
				what string
				got  time.Time
				want string
			}{
				{"StartOfDay", StartOfDay(at, loc), tc.day},
				{"StartOfNextDay", StartOfNextDay(at, loc), tc.nextDay},
				{"StartOfMonth", StartOfMonth(at, loc), tc.month},
				{"StartOfNextMonth", StartOfNextMonth(at, loc), tc.nextMon},
				{"StartOfPreviousMonth", StartOfPreviousMonth(at, loc), tc.prevMon},
				{"StartOfWeek", StartOfWeek(at, loc), tc.weekFrom},
			} {
				if !c.got.Equal(mustInstant(t, c.want)) {
					t.Errorf("%s(%s) = %s, want %s", c.what, tc.at, c.got.UTC().Format(time.RFC3339), c.want)
				}
			}
		})
	}
}

func TestPeriodLastMonth(t *testing.T) {
	t.Parallel()
	loc := santoDomingo(t)

	tests := []struct {
		name     string
		now      time.Time
		from, to string
	}{
		{"Jan 31", time.Date(2026, time.January, 31, 15, 0, 0, 0, loc), "2025-12-01T04:00:00Z", "2026-01-01T04:00:00Z"},
		{"Mar 31", time.Date(2026, time.March, 31, 15, 0, 0, 0, loc), "2026-02-01T04:00:00Z", "2026-03-01T04:00:00Z"},
		{"Mar 31 in a leap year", time.Date(2028, time.March, 31, 15, 0, 0, 0, loc), "2028-02-01T04:00:00Z", "2028-03-01T04:00:00Z"},
		{"Oct 31", time.Date(2026, time.October, 31, 15, 0, 0, 0, loc), "2026-09-01T04:00:00Z", "2026-10-01T04:00:00Z"},
		// 22:00 local on Oct 31 is already Nov 1 in UTC: still October here
		{"Oct 31 22:00 local", time.Date(2026, time.October, 31, 22, 0, 0, 0, loc), "2026-09-01T04:00:00Z", "2026-10-01T04:00:00Z"},
		{"Jan 1 00:30 local", time.Date(2026, time.January, 1, 0, 30, 0, 0, loc), "2025-12-01T04:00:00Z", "2026-01-01T04:00:00Z"},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			r, ok := Period("last_month", tc.now, loc)
			if !ok {
				t.Fatal("last_month not recognized")
			}
			if !r.From.Equal(mustInstant(t, tc.from)) || !r.To.Equal(mustInstant(t, tc.to)) {
				t.Errorf("last_month at %s = [%s, %s), want [%s, %s)", tc.now, r.From.UTC().Format(time.RFC3339), r.To.UTC().Format(time.RFC3339), tc.from, tc.to)
			}
		})
	}
}

func TestPeriods(t *testing.T) {
	t.Parallel()
	loc := santoDomingo(t)
	// Saturday Oct 31 2026, 22:00 local = Sunday Nov 1 02:00 UTC
	now := mustInstant(t, "2026-11-01T02:00:00Z")

	tests := []struct {
		period   string
		from, to string
	}{
		{"today", "2026-10-31T04:00:00Z", "2026-11-01T04:00:00Z"},
		{"this_week", "2026-10-26T04:00:00Z", "2026-11-02T04:00:00Z"},
		{"last_week", "2026-10-19T04:00:00Z", "2026-10-26T04:00:00Z"},
		{"this_month", "2026-10-01T04:00:00Z", "2026-11-01T04:00:00Z"},
		{"last_month", "2026-09-01T04:00:00Z", "2026-10-01T04:00:00Z"},
		{"this_year", "2026-01-01T04:00:00Z", "2027-01-01T04:00:00Z"},
		{"last_year", "2025-01-01T04:00:00Z", "2026-01-01T04:00:00Z"},
	}
	for _, tc := range tests {
		t.Run(tc.period, func(t *testing.T) {
			t.Parallel()
			r, ok := Period(tc.period, now, loc)
			if !ok {
				t.Fatalf("%s not recognized", tc.period)
			}
			if !r.From.Equal(mustInstant(t, tc.from)) || !r.To.Equal(mustInstant(t, tc.to)) {
				t.Errorf("%s = [%s, %s), want [%s, %s)", tc.period, r.From.UTC().Format(time.RFC3339), r.To.UTC().Format(time.RFC3339), tc.from, tc.to)
			}
		})
	}

	if _, ok := Period("fortnight", now, loc); ok {
		t.Error("unknown period accepted")
	}
	r, _ := Period("this_month", now, loc)
	if got := r.LastDay(loc).Format("2006-01-02"); got != "2026-10-31" {
		t.Errorf("this_month LastDay = %s, want 2026-10-31", got)
	}
}

func TestParseRangeBounds(t *testing.T) {
	t.Parallel()
	loc := santoDomingo(t)

	tests := []struct {
		name     string
		in       string
		from, to string
		wantErr  bool
	}{
		{name: "ISO date", in: "2026-10-31", from: "2026-10-31T04:00:00Z", to: "2026-11-01T04:00:00Z"},
		{name: "slashes", in: "2026/10/31", from: "2026-10-31T04:00:00Z", to: "2026-11-01T04:00:00Z"},
		{name: "day first", in: "31/10/2026", from: "2026-10-31T04:00:00Z", to: "2026-11-01T04:00:00Z"},
		{name: "day first dashes", in: "31-10-2026", from: "2026-10-31T04:00:00Z", to: "2026-11-01T04:00:00Z"},
		{name: "end of year", in: "2026-12-31", from: "2026-12-31T04:00:00Z", to: "2027-01-01T04:00:00Z"},
		{name: "RFC3339 keeps its instant", in: "2026-10-31T21:30:00-04:00", from: "2026-11-01T01:30:00Z", to: "2026-11-01T01:30:00.000001Z"},
		{name: "garbage", in: "yesterday", wantErr: true},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			from, errFrom := ParseRangeFrom(tc.in, loc)
			to, errTo := ParseRangeTo(tc.in, loc)
			if tc.wantErr {
				if errFrom == nil || errTo == nil {
					t.Fatalf("expected errors, got %v / %v", errFrom, errTo)
				}
				return
			}
			if errFrom != nil || errTo != nil {
				t.Fatalf("unexpected errors %v / %v", errFrom, errTo)
			}
			wantTo, err := time.Parse(time.RFC3339Nano, tc.to)
			if err != nil {
				t.Fatal(err)
			}
			if !from.Equal(mustInstant(t, tc.from)) {
				t.Errorf("from = %s, want %s", from.UTC().Format(time.RFC3339Nano), tc.from)
			}
			if !to.Equal(wantTo) {
				t.Errorf("to = %s, want %s", to.UTC().Format(time.RFC3339Nano), tc.to)
			}
		})
	}
}

func TestParseRecordDate(t *testing.T) {
	t.Parallel()
	tests := []struct {
		in, want string
		wantErr  bool
	}{
		{in: "2026-10-31", want: "2026-10-31T12:00:00Z"},
		{in: "2026/10/31", want: "2026-10-31T12:00:00Z"},
		{in: "2026-10-31T21:30:00-04:00", want: "2026-11-01T01:30:00Z"},
		{in: "31 de octubre", wantErr: true},
	}
	for _, tc := range tests {
		t.Run(tc.in, func(t *testing.T) {
			t.Parallel()
			got, err := ParseRecordDate(tc.in)
			if tc.wantErr {
				if err == nil {
					t.Fatalf("expected error, got %s", got)
				}
				return
			}
			if err != nil {
				t.Fatal(err)
			}
			if !got.Equal(mustInstant(t, tc.want)) {
				t.Errorf("ParseRecordDate(%q) = %s, want %s", tc.in, got.UTC().Format(time.RFC3339), tc.want)
			}
		})
	}
}

func TestNoonUTCIsTheSameDayInSantoDomingo(t *testing.T) {
	t.Parallel()
	loc := santoDomingo(t)
	noon := NoonUTC(2026, time.October, 31)
	if got := noon.In(loc).Format("2006-01-02"); got != "2026-10-31" {
		t.Errorf("noon UTC in Santo Domingo = %s, want 2026-10-31", got)
	}
	// 22:00 local on Oct 31 (Nov 1 in UTC): today is still Oct 31
	if got := TodayNoonUTC(mustInstant(t, "2026-11-01T02:00:00Z"), loc); !got.Equal(noon) {
		t.Errorf("TodayNoonUTC = %s, want %s", got, noon)
	}
}

func TestNormalizeMidnightUTC(t *testing.T) {
	t.Parallel()
	tests := []struct{ in, want string }{
		{"2026-10-31T00:00:00Z", "2026-10-31T12:00:00Z"},
		{"2026-10-31T00:00:00+00:00", "2026-10-31T12:00:00Z"},
		{"2026-10-31T21:30:00-04:00", "2026-10-31T21:30:00-04:00"},
		{"2026-10-31T00:00:01Z", "2026-10-31T00:00:01Z"},
		// local midnight is a real time (04:00Z), not a date-only value
		{"2026-10-31T00:00:00-04:00", "2026-10-31T00:00:00-04:00"},
	}
	for _, tc := range tests {
		t.Run(tc.in, func(t *testing.T) {
			t.Parallel()
			if got := NormalizeMidnightUTC(mustInstant(t, tc.in)); !got.Equal(mustInstant(t, tc.want)) {
				t.Errorf("NormalizeMidnightUTC(%s) = %s, want %s", tc.in, got.Format(time.RFC3339), tc.want)
			}
		})
	}
	if !NormalizeMidnightUTC(time.Time{}).IsZero() {
		t.Error("zero time changed")
	}
}

func TestAddMonthsClamped(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name  string
		start time.Time
		n     int
		want  time.Time
	}{
		{"Jan 31 + 1 = Feb 28", NoonUTC(2026, time.January, 31), 1, NoonUTC(2026, time.February, 28)},
		{"Jan 31 + 1 in a leap year = Feb 29", NoonUTC(2028, time.January, 31), 1, NoonUTC(2028, time.February, 29)},
		{"Jan 31 + 2 = Mar 31", NoonUTC(2026, time.January, 31), 2, NoonUTC(2026, time.March, 31)},
		{"Jan 31 + 3 = Apr 30", NoonUTC(2026, time.January, 31), 3, NoonUTC(2026, time.April, 30)},
		{"Aug 31 + 6 = Feb 28 next year", NoonUTC(2026, time.August, 31), 6, NoonUTC(2027, time.February, 28)},
		{"Oct 15 + 12 = Oct 15", NoonUTC(2026, time.October, 15), 12, NoonUTC(2027, time.October, 15)},
		{"Mar 31 - 1 = Feb 28", NoonUTC(2026, time.March, 31), -1, NoonUTC(2026, time.February, 28)},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			if got := AddMonthsClamped(tc.start, tc.n); !got.Equal(tc.want) {
				t.Errorf("AddMonthsClamped(%s, %d) = %s, want %s", tc.start.Format("2006-01-02"), tc.n, got.Format(time.RFC3339), tc.want.Format(time.RFC3339))
			}
		})
	}
}

func TestOrDefault(t *testing.T) {
	t.Parallel()
	if got := OrDefault(nil).String(); got != DefaultTimezone {
		t.Errorf("OrDefault(nil) = %s, want %s", got, DefaultTimezone)
	}
	if got := OrDefault(time.UTC); got != time.UTC {
		t.Errorf("OrDefault(UTC) = %s", got)
	}
}
