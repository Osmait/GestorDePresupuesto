import type { Locale } from 'date-fns'
import { enUS, es } from 'date-fns/locale'
import { useLocale } from 'next-intl'
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

const CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})(?:T00:00:00(?:\.0+)?(?:Z|[+-]00:00))?$/

/**
 * Parses API dates. Calendar dates ('2024-01-15' or midnight UTC '2024-01-15T00:00:00Z') are
 * read as local dates so they don't shift to the previous day in negative UTC offsets.
 */
function toDate(value: Date | string | number): Date {
	if (value instanceof Date) return value
	if (typeof value === 'string') {
		const match = CALENDAR_DATE.exec(value)
		if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
	}
	return new Date(value)
}

/** Formats a date (Date, ISO string or epoch ms) with Intl in the given app locale. */
export function formatLocalDate(
	value: Date | string | number,
	locale: string,
	options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' },
): string {
	const date = toDate(value)
	if (Number.isNaN(date.getTime())) return '-'
	return new Intl.DateTimeFormat(getIntlLocale(locale), options).format(date)
}
