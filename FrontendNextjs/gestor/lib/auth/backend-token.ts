import 'server-only'
import { readSessionJwt } from '@/lib/auth/session-cookie'
import { ensureFreshToken } from '@/lib/auth/token-refresh'

/**
 * Returns the backend access token for the session carried by `headers`.
 *
 * It goes through the same `ensureFreshToken` used by the next-auth `jwt`
 * callback, so when the callback already refreshed this cookie during the same
 * request (the proxy route is wrapped in `auth()`), the rotated tokens come from
 * the shared refresh store instead of a second `/auth/refresh` call.
 */
export async function getBackendAccessToken(headers: Headers): Promise<string | null> {
	const token = await readSessionJwt(headers)
	if (!token) return null

	const fresh = await ensureFreshToken(token)
	if (fresh.error || !fresh.accessToken) return null
	return fresh.accessToken
}
