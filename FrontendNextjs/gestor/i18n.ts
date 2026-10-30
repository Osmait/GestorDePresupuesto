import { cookies } from 'next/headers'
import { getRequestConfig } from 'next-intl/server'
import { APP_TIME_ZONE } from './lib/app-time'
import { LOCALE_COOKIE, resolveLocale } from './lib/i18n/locales'

export default getRequestConfig(async () => {
	// The cookie is user-controlled: only whitelisted locales reach the dynamic import.
	const cookieStore = await cookies()
	const locale = resolveLocale(cookieStore.get(LOCALE_COOKIE)?.value)

	return {
		locale,
		// Server-rendered dates (useFormatter / getFormatter) use the app's zone, not the server's (UTC on Vercel).
		timeZone: APP_TIME_ZONE,
		messages: (await import(`./messages/${locale}.json`)).default,
	}
})
