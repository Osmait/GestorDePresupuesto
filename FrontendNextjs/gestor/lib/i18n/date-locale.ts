import type { Locale } from 'date-fns'
import { enUS, es } from 'date-fns/locale'
import { useLocale } from 'next-intl'
import { APP_TIME_ZONE, parseCalendarDateString, toLocalCalendarDate } from '@/lib/app-time'
import { type AppLocale, DEFAULT_LOCALE, resolveLocale } from './locales'

const DATE_FNS_LOCALES: Record<AppLocale, Locale> = { es, en: enUS }

/** BCP 47 tag used for Intl.* formatters (dates, numbers) for each app locale. */
const INTL_LOCALES: Record<AppLocale, string> = { es: 'es-DO', en: 'en-US' }

/** Maps an app locale to the date-fns locale used by `format` and react-day-picker. */
export function getDateFnsLocale(locale: string | null | undefined): Locale {
	return DATE_FNS_LOCALES[resolveLocale(locale)]
}

/** Maps an app locale to the BCP 47 tag for `Intl.DateTimeFormat` / `toLocaleDateString`. */
export function getIntlLocale(locale: string | null | undefined): string {
	return INTL_LOCALES[resolveLocale(locale)]
}

/**
 * Active next-intl locale. Falls back to the default locale when rendered outside a
 * NextIntlClientProvider (isolated component tests that only mock `useTranslations`).
 */
export function useAppLocale(): AppLocale {
	try {
		// biome-ignore lint/correctness/useHookAtTopLevel: always called exactly once per render; the catch only covers a missing provider
		return resolveLocale(useLocale())
	} catch {
		return DEFAULT_LOCALE
	}
}

/** date-fns locale for the active next-intl locale. */
export function useDateFnsLocale(): Locale {
	return DATE_FNS_LOCALES[useAppLocale()]
}

/**
 * Formats a date with Intl in the given app locale.
 *
 * - Calendar dates ('2024-01-15', midnight UTC '2024-01-15T00:00:00Z') are shown as that day,
 *   never shifted to the previous day in negative UTC offsets.
 * - Other strings and epoch ms are instants (e.g. `created_at`): shown on their day in the
 *   app time zone (Santo Domingo), whatever the zone of the browser or the server.
 * - `Date` objects are calendar dates at local midnight of the runtime (`new Date(y, m, d)`,
 *   date pickers) and are shown in the runtime zone. For a `Date` that is an instant, pass
 *   `timeZone: APP_TIME_ZONE` in `options` (or use `getAppTodayDate()` for today).
 */
export function formatLocalDate(
	value: Date | string | number,
	locale: string,
	options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' },
): string {
	let date: Date
	let formatOptions = options
	if (value instanceof Date) {
		date = value
	} else {
		const calendar = typeof value === 'string' ? parseCalendarDateString(value) : null
		if (calendar) {
			date = toLocalCalendarDate(calendar)
		} else {
			date = new Date(value)
			if (!options.timeZone) formatOptions = { ...options, timeZone: APP_TIME_ZONE }
		}
	}
	if (Number.isNaN(date.getTime())) return '-'
	return new Intl.DateTimeFormat(getIntlLocale(locale), formatOptions).format(date)
}
