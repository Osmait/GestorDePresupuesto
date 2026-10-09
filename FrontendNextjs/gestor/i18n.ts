import { cookies } from 'next/headers'
import { getRequestConfig } from 'next-intl/server'
import { LOCALE_COOKIE, resolveLocale } from './lib/i18n/locales'

export default getRequestConfig(async () => {
	// The cookie is user-controlled: only whitelisted locales reach the dynamic import.
	const cookieStore = await cookies()
	const locale = resolveLocale(cookieStore.get(LOCALE_COOKIE)?.value)

	return {
		locale,
		messages: (await import(`./messages/${locale}.json`)).default,
	}
})
