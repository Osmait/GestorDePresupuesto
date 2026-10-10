import 'server-only'
import type { JWT } from 'next-auth/jwt'
import { readSessionJwt } from '@/lib/auth/session-cookie'
import { ensureFreshToken } from '@/lib/auth/token-refresh'

/**
 * Returns the backend access token for the session carried by `headers`.
 *
 * It goes through the same `ensureFreshToken` used by the next-auth `jwt`
 * callback, so when the callback already refreshed this cookie during the same
 * request (the proxy route's refresh path is wrapped in `auth()`), the rotated
 * tokens come from the shared refresh store instead of a second `/auth/refresh` call.
 *
 * `decoded` is the session already decoded from the same `headers` by the
 * caller (null when there is none); passing it skips a second cookie decrypt.
 */
export async function getBackendAccessToken(headers: Headers, decoded?: JWT | null): Promise<string | null> {
	const token = decoded === undefined ? await readSessionJwt(headers) : decoded
	if (!token) return null

	const fresh = await ensureFreshToken(token)
	if (fresh.error || !fresh.accessToken) return null
	return fresh.accessToken
}
