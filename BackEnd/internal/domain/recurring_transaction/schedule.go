package recurring_transaction

import (
	"fmt"
	"time"
)

// Schedule helpers work on civil (calendar) dates. A civil date is represented
// as a time.Time at 00:00 UTC; the year/month/day fields are what matter. The
// time zone in which "today" is observed is decided once, by DateIn, so the
// whole scheduler uses a single time source and zone.

const (
	MinDayOfMonth = 1
	MaxDayOfMonth = 31
)

// ValidateDayOfMonth checks that day is within 1..31.
func ValidateDayOfMonth(day int) error {
	if day < MinDayOfMonth || day > MaxDayOfMonth {
		return fmt.Errorf("day_of_month must be between %d and %d, got %d", MinDayOfMonth, MaxDayOfMonth, day)
	}
	return nil
}

// CivilDate truncates t to its calendar date (using t's own location) and
// returns it as midnight UTC.
func CivilDate(t time.Time) time.Time {
	y, m, d := t.Date()
	return time.Date(y, m, d, 0, 0, 0, 0, time.UTC)
}

// DateIn returns the calendar date of instant t as observed in loc.
func DateIn(t time.Time, loc *time.Location) time.Time {
	if loc == nil {
		loc = time.UTC
	}
	return CivilDate(t.In(loc))
}

// DaysInMonth returns the number of days in the given month.
func DaysInMonth(year int, month time.Month) int {
	return time.Date(year, month+1, 0, 0, 0, 0, 0, time.UTC).Day()
}

// OccurrenceInMonth returns the occurrence of dayOfMonth in the given month,
// clamped to the last day of the month when the day does not exist
// (e.g. day 31 in February -> Feb 28, or Feb 29 in leap years).
func OccurrenceInMonth(year int, month time.Month, dayOfMonth int) time.Time {
	// Normalize month overflow (e.g. month 13 -> January next year).
	first := time.Date(year, month, 1, 0, 0, 0, 0, time.UTC)
	year, month = first.Year(), first.Month()

	day := dayOfMonth
	if day < MinDayOfMonth {
		day = MinDayOfMonth
	}
	if last := DaysInMonth(year, month); day > last {
		day = last
	}
	return time.Date(year, month, day, 0, 0, 0, 0, time.UTC)
}

// FirstOccurrenceOnOrAfter returns the first occurrence of dayOfMonth that is
// on or after date.
func FirstOccurrenceOnOrAfter(date time.Time, dayOfMonth int) time.Time {
	date = CivilDate(date)
	occ := OccurrenceInMonth(date.Year(), date.Month(), dayOfMonth)
	if occ.Before(date) {
		occ = OccurrenceInMonth(date.Year(), date.Month()+1, dayOfMonth)
	}
	return occ
}

// NextOccurrenceAfter returns the occurrence in the month following the given
// occurrence. It is always derived from dayOfMonth (not from the previous,
// possibly clamped, date), so Jan 31 -> Feb 28 -> Mar 31.
func NextOccurrenceAfter(occurrence time.Time, dayOfMonth int) time.Time {
	occurrence = CivilDate(occurrence)
	return OccurrenceInMonth(occurrence.Year(), occurrence.Month()+1, dayOfMonth)
}

// RescheduleOnDayChange computes the next execution date when a rule's
// day_of_month changes. It keeps the "at most once per calendar month"
// guarantee: if the current month's occurrence was already executed (the
// existing next date is in a later month), the new day starts in that later
// month instead of producing a second execution this month.
func RescheduleOnDayChange(today time.Time, currentNext *time.Time, dayOfMonth int) time.Time {
	next := FirstOccurrenceOnOrAfter(today, dayOfMonth)
	if currentNext == nil {
		return next
	}
	cur := CivilDate(*currentNext)
	curMonth := time.Date(cur.Year(), cur.Month(), 1, 0, 0, 0, 0, time.UTC)
	nextMonth := time.Date(next.Year(), next.Month(), 1, 0, 0, 0, 0, time.UTC)
	if curMonth.After(nextMonth) {
		return OccurrenceInMonth(cur.Year(), cur.Month(), dayOfMonth)
	}
	return next
}
