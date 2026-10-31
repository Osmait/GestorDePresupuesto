// Package apptime holds the calendar rules of the app time zone (APP_TIMEZONE,
// America/Santo_Domingo by default).
//
// Transactions are instants (timestamptz). Days and months, however, are the
// calendar days and months of the app time zone: a bill paid on Oct 31 at
// 21:30 in Santo Domingo is 2026-11-01T01:30Z, and it belongs to October.
// The helpers here cut ranges of instants at local midnight, and map
// date-only values (YYYY-MM-DD) to instants.
//
// Two conventions are used for date-only values:
//
//   - a range bound (date_from / date_to filters) is a local calendar day:
//     [00:00 local of date_from, 00:00 local of the day after date_to);
//   - the date of a record (a transaction, a loan payment, an AI-extracted
//     statement line) is that calendar day at 12:00 UTC, which is the same
//     calendar day in UTC and in every zone between UTC-12 and UTC+11, so it
//     shows on that day everywhere (this is the MCP create_transaction
//     convention).
//
// Every function takes the location explicitly; nothing here is global state.
package apptime

import (
	"fmt"
	"time"
)

// DefaultTimezone is the app time zone when APP_TIMEZONE is not set. It must
// match the app_timezone() SQL function (migration 000062).
const DefaultTimezone = "America/Santo_Domingo"

// defaultOffset is Santo Domingo's offset (UTC-4, no DST), used only when the
// tz database is not available.
const defaultOffset = -4 * 60 * 60

// Default returns the default app location: America/Santo_Domingo from the tz
// database, or a fixed UTC-4 zone with the same name when it is missing.
func Default() *time.Location {
	if loc, err := time.LoadLocation(DefaultTimezone); err == nil {
		return loc
	}
	return time.FixedZone(DefaultTimezone, defaultOffset)
}

// OrDefault returns loc, or Default() when loc is nil (services built without
// a location, e.g. in unit tests).
func OrDefault(loc *time.Location) *time.Location {
	if loc == nil {
		return Default()
	}
	return loc
}

// Date returns 00:00 local of the calendar day year-month-day in loc.
// Out-of-range values are normalized like time.Date (day 0 = last day of the
// previous month).
func Date(year int, month time.Month, day int, loc *time.Location) time.Time {
	return time.Date(year, month, day, 0, 0, 0, 0, OrDefault(loc))
}

// StartOfDay returns 00:00 local of t's calendar day in loc.
func StartOfDay(t time.Time, loc *time.Location) time.Time {
	loc = OrDefault(loc)
	y, m, d := t.In(loc).Date()
	return time.Date(y, m, d, 0, 0, 0, 0, loc)
}

// StartOfNextDay returns 00:00 local of the day after t's calendar day in loc.
func StartOfNextDay(t time.Time, loc *time.Location) time.Time {
	return StartOfDay(t, loc).AddDate(0, 0, 1)
}

// StartOfMonth returns 00:00 local of the first day of t's month in loc.
func StartOfMonth(t time.Time, loc *time.Location) time.Time {
	loc = OrDefault(loc)
	y, m, _ := t.In(loc).Date()
	return time.Date(y, m, 1, 0, 0, 0, 0, loc)
}

// StartOfNextMonth returns 00:00 local of the first day of the month after
// t's month in loc.
func StartOfNextMonth(t time.Time, loc *time.Location) time.Time {
	return StartOfMonth(t, loc).AddDate(0, 1, 0)
}

// StartOfPreviousMonth returns 00:00 local of the first day of the month
// before t's month in loc. It steps from the 1st, so Oct 31 gives Sep 1 (not
// "Sep 31" = Oct 1 like t.AddDate(0, -1, 0)).
func StartOfPreviousMonth(t time.Time, loc *time.Location) time.Time {
	return StartOfMonth(t, loc).AddDate(0, -1, 0)
}

// StartOfWeek returns 00:00 local of the Monday of t's week in loc.
func StartOfWeek(t time.Time, loc *time.Location) time.Time {
	day := StartOfDay(t, loc)
	offset := (int(day.Weekday()) + 6) % 7 // Monday = 0 ... Sunday = 6
	return day.AddDate(0, 0, -offset)
}

// StartOfYear returns 00:00 local of January 1st of t's year in loc.
func StartOfYear(t time.Time, loc *time.Location) time.Time {
	loc = OrDefault(loc)
	return time.Date(t.In(loc).Year(), time.January, 1, 0, 0, 0, 0, loc)
}

// AddMonthsClamped adds n months to t keeping its day of month, clamped to
// the last day of the target month: Jan 31 + 1 = Feb 28 (29 in leap years),
// Jan 31 + 2 = Mar 31 (t.AddDate gives Mar 3 and Mar 31). The clock and the
// location of t are kept.
func AddMonthsClamped(t time.Time, n int) time.Time {
	y, m, d := t.Date()
	first := time.Date(y, m+time.Month(n), 1, t.Hour(), t.Minute(), t.Second(), t.Nanosecond(), t.Location())
	if last := DaysIn(first.Year(), first.Month()); d > last {
		d = last
	}
	return first.AddDate(0, 0, d-1)
}

// DaysIn returns the number of days of month in year.
func DaysIn(year int, month time.Month) int {
	return time.Date(year, month+1, 0, 0, 0, 0, 0, time.UTC).Day()
}

// NoonUTC returns 12:00 UTC of the calendar day year-month-day.
func NoonUTC(year int, month time.Month, day int) time.Time {
	return time.Date(year, month, day, 12, 0, 0, 0, time.UTC)
}

// TodayNoonUTC returns today's calendar day in loc (at now) as 12:00 UTC: the
// record date of "today" for date-only fields.
func TodayNoonUTC(now time.Time, loc *time.Location) time.Time {
	y, m, d := now.In(OrDefault(loc)).Date()
	return NoonUTC(y, m, d)
}

// NormalizeMidnightUTC maps an instant at exactly 00:00:00 UTC — how a
// date-only value parsed without a zone (or an LLM's "YYYY-MM-DDT00:00:00Z")
// arrives — to 12:00 UTC of the same calendar day. Other instants are
// returned unchanged, as is the zero time.
func NormalizeMidnightUTC(t time.Time) time.Time {
	if t.IsZero() {
		return t
	}
	u := t.UTC()
	if u.Hour() == 0 && u.Minute() == 0 && u.Second() == 0 && u.Nanosecond() == 0 {
		return NoonUTC(u.Year(), u.Month(), u.Day())
	}
	return t
}

// isoDateLayouts are the year-first date-only layouts; dateLayouts add the
// day-first ones the transaction filter has always accepted.
var (
	isoDateLayouts = []string{"2006-01-02", "2006/01/02"}
	dateLayouts    = append(append([]string{}, isoDateLayouts...), "02/01/2006", "02-01-2006")
)

func parseLayouts(s string, layouts []string) (int, time.Month, int, error) {
	for _, layout := range layouts {
		if t, err := time.Parse(layout, s); err == nil {
			y, m, d := t.Date()
			return y, m, d, nil
		}
	}
	return 0, 0, 0, fmt.Errorf("unable to parse date: %s", s)
}

// ParseCalendarDate parses a date-only value (YYYY-MM-DD, YYYY/MM/DD,
// DD/MM/YYYY or DD-MM-YYYY) into its year, month and day.
func ParseCalendarDate(s string) (int, time.Month, int, error) {
	return parseLayouts(s, dateLayouts)
}

// ParseRangeFrom parses the start of a date range: a date-only value is 00:00
// local (loc) of that day; an RFC3339 value is its exact instant.
func ParseRangeFrom(s string, loc *time.Location) (time.Time, error) {
	if t, err := time.Parse(time.RFC3339Nano, s); err == nil {
		return t, nil
	}
	y, m, d, err := ParseCalendarDate(s)
	if err != nil {
		return time.Time{}, err
	}
	return Date(y, m, d, loc), nil
}

// ParseRangeTo parses the end of a date range as an exclusive bound: a
// date-only value includes its whole local day, so the bound is 00:00 local
// of the next day; an RFC3339 value includes its exact instant, so the bound
// is the next microsecond (PostgreSQL's resolution).
func ParseRangeTo(s string, loc *time.Location) (time.Time, error) {
	if t, err := time.Parse(time.RFC3339Nano, s); err == nil {
		return t.Truncate(time.Microsecond).Add(time.Microsecond), nil
	}
	y, m, d, err := ParseCalendarDate(s)
	if err != nil {
		return time.Time{}, err
	}
	return Date(y, m, d+1, loc), nil
}

// ParseRecordDate parses the date of a record (transaction, payment): RFC3339
// as given, or a year-first date-only value (YYYY-MM-DD, YYYY/MM/DD) as that
// calendar day at 12:00 UTC.
func ParseRecordDate(s string) (time.Time, error) {
	if t, err := time.Parse(time.RFC3339Nano, s); err == nil {
		return t, nil
	}
	y, m, d, err := parseLayouts(s, isoDateLayouts)
	if err != nil {
		return time.Time{}, fmt.Errorf("invalid date %q: use YYYY-MM-DD or RFC3339", s)
	}
	return NoonUTC(y, m, d), nil
}

// Range is a half-open range of instants [From, To).
type Range struct {
	From time.Time
	To   time.Time
}

// LastDay returns 00:00 local of the last calendar day of the range (the day
// before To), for APIs that take inclusive calendar days.
func (r Range) LastDay(loc *time.Location) time.Time {
	return StartOfDay(r.To.Add(-time.Nanosecond), loc)
}

// Period returns the range of a named period around now in loc: today,
// this_week / last_week (Monday to Sunday), this_month / last_month,
// this_year / last_year. ok is false for an unknown name.
func Period(name string, now time.Time, loc *time.Location) (Range, bool) {
	loc = OrDefault(loc)
	switch name {
	case "today":
		return Range{StartOfDay(now, loc), StartOfNextDay(now, loc)}, true
	case "this_week":
		from := StartOfWeek(now, loc)
		return Range{from, from.AddDate(0, 0, 7)}, true
	case "last_week":
		to := StartOfWeek(now, loc)
		return Range{to.AddDate(0, 0, -7), to}, true
	case "this_month":
		return Range{StartOfMonth(now, loc), StartOfNextMonth(now, loc)}, true
	case "last_month":
		return Range{StartOfPreviousMonth(now, loc), StartOfMonth(now, loc)}, true
	case "this_year":
		from := StartOfYear(now, loc)
		return Range{from, from.AddDate(1, 0, 0)}, true
	case "last_year":
		to := StartOfYear(now, loc)
		return Range{to.AddDate(-1, 0, 0), to}, true
	}
	return Range{}, false
}
