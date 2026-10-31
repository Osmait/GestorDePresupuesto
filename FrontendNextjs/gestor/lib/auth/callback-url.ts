const DEFAULT_AFTER_LOGIN = '/app'

/** Placeholder origin used only to resolve the value; any other origin means it left the app. */
const PARSE_BASE = 'http://localhost'

/**
 * Control characters and backslashes are rejected outright: the URL parser
 * strips tab/newline and reads `\` as `/`, so `/\t/evil.com` or `/\\evil.com`
 * would resolve to another host.
 */
// biome-ignore lint/suspicious/noControlCharactersInRegex: matching control characters is the point
const UNSAFE_CHARS = /[\x00-\x1f\x7f\\]/

/**
 * Only same-origin relative paths are accepted, to avoid open redirects. The
 * value is resolved with the URL parser (the same way the browser will) and
 * the normalized path + query + hash is returned, never the raw input.
 */
export function getSafeCallbackUrl(value: string | null | undefined): string {
	if (!value?.startsWith('/') || UNSAFE_CHARS.test(value)) return DEFAULT_AFTER_LOGIN

	let url: URL
	try {
		url = new URL(value, PARSE_BASE)
	} catch {
		return DEFAULT_AFTER_LOGIN
	}
	if (url.origin !== PARSE_BASE) return DEFAULT_AFTER_LOGIN

	// Dot segments can collapse into a protocol-relative path (`/.//evil.com` -> `//evil.com`).
	if (url.pathname.startsWith('//')) return DEFAULT_AFTER_LOGIN
	if (url.pathname.startsWith('/login') || url.pathname.startsWith('/register')) return DEFAULT_AFTER_LOGIN
	return `${url.pathname}${url.search}${url.hash}`
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
