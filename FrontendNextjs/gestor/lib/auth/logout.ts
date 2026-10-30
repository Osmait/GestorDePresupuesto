import 'server-only'
import type { JWT } from 'next-auth/jwt'
import { getRotatedRefreshToken, sessionUserId } from '@/lib/auth/token-refresh'
import { getBackendUrl } from '@/lib/backend-url'
import { currentClientIpHeaders } from '@/lib/server/client-ip'

/** Sign-out must not hang on a slow backend: the cookie is cleared either way. */
export const LOGOUT_TIMEOUT_MS = 3000

async function revokeRefreshToken(refreshToken: string, ipHeaders: Record<string, string>): Promise<void> {
	try {
		const response = await fetch(`${getBackendUrl()}/auth/logout`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', ...ipHeaders },
			body: JSON.stringify({ refresh_token: refreshToken }),
			cache: 'no-store',
			signal: AbortSignal.timeout(LOGOUT_TIMEOUT_MS),
		})
		if (!response.ok) console.error(`[auth] backend logout failed: HTTP ${response.status}`)
	} catch (error) {
		console.error('[auth] backend logout failed:', error instanceof Error ? error.message : error)
	}
}

/**
 * Revokes the backend refresh token of a session that is signing out, so a
 * copy of the session cookie (or of the token) stops working once the access
 * token expires. Runs in the next-auth `signOut` event; it never throws.
 *
 * When this process rotated the cookie's refresh token moments ago and the
 * rotated cookie never reached the browser, the token that replaced it is
 * revoked too: the backend only revokes the exact token it is given.
 */
export async function revokeBackendSession(token: JWT | null | undefined): Promise<void> {
	const refreshToken = typeof token?.refreshToken === 'string' ? token.refreshToken : ''
	// Demo sessions and sessions whose refresh already failed carry no refresh token.
	if (!token || !refreshToken) return

	try {
		const ipHeaders = await currentClientIpHeaders()
		const rotated = await getRotatedRefreshToken(refreshToken, sessionUserId(token))
		const tokens = rotated && rotated !== refreshToken ? [refreshToken, rotated] : [refreshToken]
		await Promise.all(tokens.map((value) => revokeRefreshToken(value, ipHeaders)))
	} catch (error) {
		console.error('[auth] backend logout failed:', error instanceof Error ? error.message : error)
	}
}
