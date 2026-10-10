import { getToken, type JWT } from 'next-auth/jwt'

const SECURE_SESSION_COOKIE = '__Secure-authjs.session-token'

function getAuthSecret(): string | undefined {
	return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET
}

/**
 * Decodes the encrypted next-auth session cookie WITHOUT running callbacks, so
 * it never triggers a token refresh. Only the cookie header is considered (the
 * `Authorization` header fallback of `getToken` is deliberately not used).
 */
export async function readSessionJwt(headers: Headers): Promise<JWT | null> {
	const cookie = headers.get('cookie')
	const secret = getAuthSecret()
	if (!cookie || !secret) return null

	try {
		return await getToken({
			req: { headers: new Headers({ cookie }) },
			secret,
			secureCookie: cookie.includes(SECURE_SESSION_COOKIE),
		})
	} catch {
		return null
	}
}

/** True when the decoded session can still be used (or refreshed) by the server. */
export function isUsableSession(token: JWT | null): token is JWT {
	if (!token || token.error) return false
	if (token.refreshToken) return true
	return typeof token.accessTokenExpires === 'number' && Date.now() < token.accessTokenExpires
}
