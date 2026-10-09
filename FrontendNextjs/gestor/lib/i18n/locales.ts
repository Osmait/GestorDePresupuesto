export const SUPPORTED_LOCALES = ['es', 'en'] as const
export type AppLocale = (typeof SUPPORTED_LOCALES)[number]
export const DEFAULT_LOCALE: AppLocale = 'es'

/** Cookie holding the user's UI locale (written by the language switcher). */
export const LOCALE_COOKIE = 'locale'

/** Maps an untrusted value (e.g. the `locale` cookie) to a supported locale. */
export function resolveLocale(value: string | null | undefined): AppLocale {
	return SUPPORTED_LOCALES.find((locale) => locale === value) ?? DEFAULT_LOCALE
}
