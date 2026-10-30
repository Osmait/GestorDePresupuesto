/**
 * The app's time zone. Days and months (today, this month, the day a
 * transaction belongs to) are cut in Santo Domingo, whatever the zone of the
 * browser or of the server rendering the page (Vercel runs in UTC). The
 * backend uses the same zone (APP_TIMEZONE).
 *
 * Two kinds of values are used for dates in the UI:
 * - instants (`created_at`, `new Date()`): converted to their calendar day in
 *   APP_TIME_ZONE with the helpers below;
 * - calendar dates: `Date` objects at local midnight of the runtime
 *   (`new Date(y, m, d)`, what react-day-picker and date-fns work with) or
 *   'YYYY-MM-DD' strings. They never shift between zones.
 */
export const APP_TIME_ZONE = 'America/Santo_Domingo'

/** A calendar date. `month` is 1-based (January = 1). */
export interface CalendarDateParts {
	year: number
	month: number
	day: number
}

const partsFormatters = new Map<string, Intl.DateTimeFormat>()

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
	let formatter = partsFormatters.get(timeZone)
	if (!formatter) {
		// 'en-US' is only used to read numeric year/month/day parts (never displayed),
		// so it is intentionally independent of the UI locale.
		formatter = new Intl.DateTimeFormat('en-US', {
			timeZone,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
		})
		partsFormatters.set(timeZone, formatter)
	}
	return formatter
}

/** The calendar day of the instant `date` in `timeZone` (the app zone by default). */
export function getDatePartsInTimeZone(date: Date, timeZone: string = APP_TIME_ZONE): CalendarDateParts {
	const parts = partsFormatter(timeZone).formatToParts(date)
	const year = Number(parts.find((part) => part.type === 'year')?.value || '0')
	const month = Number(parts.find((part) => part.type === 'month')?.value || '1')
	const day = Number(parts.find((part) => part.type === 'day')?.value || '1')
	return { year, month, day }
}

/** 'YYYY-MM-DD' of a calendar date. */
export function toCalendarDateString({ year, month, day }: CalendarDateParts): string {
	return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** 'YYYY-MM-DD' of the calendar day of the instant `date` in `timeZone` (the app zone by default). */
export function formatDateInTimeZone(date: Date, timeZone: string = APP_TIME_ZONE): string {
	return toCalendarDateString(getDatePartsInTimeZone(date, timeZone))
}

/** 'YYYY-MM-DD' of a calendar-date `Date` (local midnight of the runtime, e.g. from a date picker). */
export function formatCalendarDate(date: Date): string {
	return toCalendarDateString({ year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() })
}

/** The calendar parts of a calendar-date `Date` (local midnight of the runtime). */
export function calendarDateParts(date: Date): CalendarDateParts {
	return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() }
}

/** Today's calendar date in the app zone. */
export function getAppToday(now: Date = new Date()): CalendarDateParts {
	return getDatePartsInTimeZone(now)
}

/** Today's date in the app zone as 'YYYY-MM-DD'. */
export function getAppTodayString(now: Date = new Date()): string {
	return toCalendarDateString(getAppToday(now))
}

/** A calendar date as a `Date` at local midnight of the runtime (what pickers and date-fns expect). */
export function toLocalCalendarDate({ year, month, day }: CalendarDateParts): Date {
	return new Date(year, month - 1, day)
}

/** Today's app-zone date as a calendar-date `Date` (local midnight of the runtime). */
export function getAppTodayDate(now: Date = new Date()): Date {
	return toLocalCalendarDate(getAppToday(now))
}

/** The app-zone calendar day of the instant `date`, as a calendar-date `Date` (for pickers). */
export function instantToCalendarDate(date: Date): Date {
	return toLocalCalendarDate(getDatePartsInTimeZone(date))
}

/**
 * First and last day of the app-zone month `offset` months from the current
 * one (0 = this month, -1 = last month), as calendar-date `Date`s.
 */
export function getAppMonthRange(offset = 0, now: Date = new Date()): { from: Date; to: Date } {
	const { year, month } = getAppToday(now)
	return { from: new Date(year, month - 1 + offset, 1), to: new Date(year, month + offset, 0) }
}

/** `getAppMonthRange` as 'YYYY-MM-DD' strings (API `date_from` / `date_to`). */
export function getAppMonthRangeStrings(offset = 0, now: Date = new Date()): { from: string; to: string } {
	const { from, to } = getAppMonthRange(offset, now)
	return { from: formatCalendarDate(from), to: formatCalendarDate(to) }
}

const CALENDAR_DATE_STRING = /^(\d{4})-(\d{2})-(\d{2})(?:T00:00:00(?:\.0+)?(?:Z|[+-]00:00))?$/

/**
 * Parses a calendar date sent by the API: 'YYYY-MM-DD' or midnight UTC
 * ('YYYY-MM-DDT00:00:00Z', how DATE columns and date-only values are
 * serialized). Returns null for any other value (a real instant).
 */
export function parseCalendarDateString(value: string): CalendarDateParts | null {
	const match = CALENDAR_DATE_STRING.exec(value)
	if (!match) return null
	return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) }
}

/**
 * The app-zone calendar day of an API date: a calendar date ('YYYY-MM-DD',
 * midnight UTC) as is, any other value as the day of that instant in the app
 * zone. Returned as a calendar-date `Date`; invalid values give an invalid Date.
 */
export function parseCalendarDate(value: string): Date {
	const calendar = parseCalendarDateString(value)
	if (calendar) return toLocalCalendarDate(calendar)
	const instant = new Date(value)
	if (Number.isNaN(instant.getTime())) return instant
	return instantToCalendarDate(instant)
}

/** The calendar day at 12:00 UTC: the same day in UTC and in Santo Domingo (backend convention for date-only values). */
export function calendarDateToNoonUTC({ year, month, day }: CalendarDateParts): Date {
	return new Date(Date.UTC(year, month - 1, day, 12))
}

/** Whether two calendar dates are the same day. */
export function isSameCalendarDay(a: CalendarDateParts, b: CalendarDateParts): boolean {
	return a.year === b.year && a.month === b.month && a.day === b.day
}

/**
 * The instant to store for a transaction whose day was picked in a calendar
 * (`picked`, a calendar-date `Date`): the `current` instant when it already is
 * on that app-zone day (editing without changing the day keeps the time), now
 * when the day is today, and that day at 12:00 UTC otherwise, so it lands on
 * the picked day on every screen.
 */
export function pickedDayToInstant(picked: Date, current?: Date, now: Date = new Date()): Date {
	const day = calendarDateParts(picked)
	if (current && !Number.isNaN(current.getTime()) && isSameCalendarDay(getDatePartsInTimeZone(current), day)) {
		return current
	}
	if (isSameCalendarDay(getAppToday(now), day)) return now
	return calendarDateToNoonUTC(day)
}

/**
 * An extracted (AI) transaction date as the instant to save: a calendar date
 * (date-only or midnight UTC, i.e. no time on the document) becomes that day
 * at 12:00 UTC; a real timestamp is kept.
 */
export function extractedDateToInstant(value: string): Date {
	const calendar = parseCalendarDateString(value)
	if (calendar) return calendarDateToNoonUTC(calendar)
	return new Date(value)
}
