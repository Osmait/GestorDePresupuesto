const DEFAULT_AFTER_LOGIN = '/app'

/** Only same-origin relative paths are accepted, to avoid open redirects. */
export function getSafeCallbackUrl(value: string | null | undefined): string {
	if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
		return DEFAULT_AFTER_LOGIN
	}
	if (value.startsWith('/login') || value.startsWith('/register')) return DEFAULT_AFTER_LOGIN
	return value
}

const AUTH_PAGES = ['/login', '/register']

/** True for the sign-in / sign-up pages (where an expired session must not trigger another sign-out). */
export function isAuthPagePath(pathname: string | null | undefined): boolean {
	if (!pathname) return false
	return AUTH_PAGES.some((page) => pathname === page || pathname.startsWith(`${page}/`))
}

/** Reads `?callbackUrl=` from the current location (browser only). */
export function getCallbackUrlFromLocation(): string {
	if (typeof window === 'undefined') return DEFAULT_AFTER_LOGIN
	return getSafeCallbackUrl(new URLSearchParams(window.location.search).get('callbackUrl'))
}

/** `?reason=` value telling the login page that the previous session expired. */
export const SESSION_EXPIRED_REASON = 'session_expired'

/**
 * Login URL that sends the user back to `returnTo` after signing in. Unsafe or
 * auth-page targets fall back to the default (see `getSafeCallbackUrl`).
 */
export function buildLoginUrl(returnTo?: string | null, reason?: typeof SESSION_EXPIRED_REASON): string {
	const params = new URLSearchParams({ callbackUrl: getSafeCallbackUrl(returnTo) })
	if (reason) params.set('reason', reason)
	return `/login?${params.toString()}`
}

/** Current path + query (browser only), to be used as a login `callbackUrl`. */
export function getCurrentPathFromLocation(): string {
	if (typeof window === 'undefined') return DEFAULT_AFTER_LOGIN
	return `${window.location.pathname}${window.location.search}`
}
