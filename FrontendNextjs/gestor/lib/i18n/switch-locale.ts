import Cookies from 'js-cookie'
import { LOCALE_COOKIE, resolveLocale } from './locales'

/**
 * Switches the UI language: stores it in the `locale` cookie (read by the
 * server for messages and the backend's Accept-Language) and reloads, so
 * server components render in the new language too. The one writer of the
 * locale cookie; used by every language control.
 */
export function switchLocale(locale: string) {
	Cookies.set(LOCALE_COOKIE, resolveLocale(locale), { path: '/', expires: 365, sameSite: 'lax' })
	window.location.reload()
}
