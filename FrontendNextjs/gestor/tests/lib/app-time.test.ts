import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
	APP_TIME_ZONE,
	extractedDateToInstant,
	formatCalendarDate,
	formatDateInTimeZone,
	getAppMonthRange,
	getAppMonthRangeStrings,
	getAppToday,
	getAppTodayDate,
	getAppTodayString,
	instantToCalendarDate,
	parseCalendarDate,
	pickedDayToInstant,
} from '@/lib/app-time'
import { formatLocalDate } from '@/lib/i18n/date-locale'
import { localToday } from '@/lib/monthlyPlanUtils'

// 2026-10-31 22:00 in Santo Domingo (UTC-4) is already November 1st in UTC:
// anything computed with the UTC (server) clock would say November / day 1.
const NOW = new Date('2026-11-01T02:00:00Z')

describe('app time zone helpers at 2026-10-31T22:00-04:00', () => {
	beforeEach(() => {
		vi.useFakeTimers()
		vi.setSystemTime(NOW)
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it('uses Santo Domingo', () => {
		expect(APP_TIME_ZONE).toBe('America/Santo_Domingo')
	})

	it('reads today as October 31', () => {
		expect(getAppToday()).toEqual({ year: 2026, month: 10, day: 31 })
		expect(getAppTodayString()).toBe('2026-10-31')
		expect(formatDateInTimeZone(new Date())).toBe('2026-10-31')
		expect(formatDateInTimeZone(new Date(), 'UTC')).toBe('2026-11-01')
	})

	it('returns today as a local calendar date for pickers', () => {
		const today = getAppTodayDate()
		expect(today.getFullYear()).toBe(2026)
		expect(today.getMonth()).toBe(9)
		expect(today.getDate()).toBe(31)
		expect(formatCalendarDate(today)).toBe('2026-10-31')
	})

	it('selects October as the current month', () => {
		expect(getAppMonthRangeStrings()).toEqual({ from: '2026-10-01', to: '2026-10-31' })
		const { from, to } = getAppMonthRange()
		expect([from.getMonth(), from.getDate(), to.getMonth(), to.getDate()]).toEqual([9, 1, 9, 31])
	})

	it('selects September as last month and wraps years', () => {
		expect(getAppMonthRangeStrings(-1)).toEqual({ from: '2026-09-01', to: '2026-09-30' })
		expect(getAppMonthRangeStrings(-10)).toEqual({ from: '2025-12-01', to: '2025-12-31' })
		expect(getAppMonthRangeStrings(2)).toEqual({ from: '2026-12-01', to: '2026-12-31' })
	})

	it('gives the monthly plan October 31', () => {
		expect(localToday()).toEqual({ year: 2026, month: 9, day: 31 })
	})

	it('formats instants on their Santo Domingo day', () => {
		const options: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric' }
		expect(formatLocalDate('2026-11-01T02:00:00Z', 'en', options)).toBe('October 31')
		expect(formatLocalDate(NOW.getTime(), 'en', options)).toBe('October 31')
		expect(formatLocalDate(NOW, 'en', { ...options, timeZone: APP_TIME_ZONE })).toBe('October 31')
		expect(formatLocalDate(getAppTodayDate(), 'en', options)).toBe('October 31')
	})

	it('keeps calendar dates on their day', () => {
		const options: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric' }
		expect(formatLocalDate('2026-11-01', 'en', options)).toBe('November 1')
		expect(formatLocalDate('2026-11-01T00:00:00Z', 'en', options)).toBe('November 1')
		expect(formatLocalDate(new Date(2026, 10, 1), 'en', options)).toBe('November 1')
	})

	it('parses API dates as app-zone calendar days', () => {
		expect(formatCalendarDate(parseCalendarDate('2026-10-31'))).toBe('2026-10-31')
		expect(formatCalendarDate(parseCalendarDate('2026-10-31T00:00:00Z'))).toBe('2026-10-31')
		expect(formatCalendarDate(parseCalendarDate('2026-11-01T02:00:00Z'))).toBe('2026-10-31')
		expect(formatCalendarDate(instantToCalendarDate(NOW))).toBe('2026-10-31')
		expect(Number.isNaN(parseCalendarDate('nope').getTime())).toBe(true)
	})

	it('saves extracted calendar dates at 12:00 UTC and keeps real timestamps', () => {
		expect(extractedDateToInstant('2026-10-31').toISOString()).toBe('2026-10-31T12:00:00.000Z')
		expect(extractedDateToInstant('2026-10-31T00:00:00Z').toISOString()).toBe('2026-10-31T12:00:00.000Z')
		expect(extractedDateToInstant('2026-10-31T21:30:00-04:00').toISOString()).toBe('2026-11-01T01:30:00.000Z')
	})

	it('turns a picked day into the instant the user means', () => {
		// today: now (not 00:00, not tomorrow in UTC)
		expect(pickedDayToInstant(new Date(2026, 9, 31)).toISOString()).toBe(NOW.toISOString())
		// a past day: that day at 12:00 UTC, the same day in Santo Domingo
		expect(pickedDayToInstant(new Date(2026, 9, 15)).toISOString()).toBe('2026-10-15T12:00:00.000Z')
		// editing without changing the day keeps the stored instant
		const stored = new Date('2026-10-01T03:30:00Z') // 2026-09-30 23:30 in Santo Domingo
		expect(pickedDayToInstant(new Date(2026, 8, 30), stored)).toBe(stored)
		expect(pickedDayToInstant(new Date(2026, 9, 1), stored).toISOString()).toBe('2026-10-01T12:00:00.000Z')
	})
})
