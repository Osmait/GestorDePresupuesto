import 'server-only'
import type { JWT } from 'next-auth/jwt'
import { decodeJwtClaims, getJwtExpiryMs } from '@/lib/auth/jwt-utils'
import { getBackendUrl } from '@/lib/backend-url'

/** Refresh proactively at most this long before the access token expires. */
export const REFRESH_BUFFER_MS = 5 * 60 * 1000

/**
 * How long before expiry the access token is refreshed: min(5 min, 50% of the
 * token lifetime). With a short-lived token (e.g. 60s) a fixed 5-minute buffer
 * would rotate the refresh token on every single request. The lifetime comes
 * from the access token's own `iat`/`exp` claims; when it cannot be derived the
 * 5-minute cap is used.
 */
export function getRefreshBufferMs(accessToken: unknown): number {
	if (typeof accessToken !== 'string' || !accessToken) return REFRESH_BUFFER_MS
	const claims = decodeJwtClaims(accessToken)
	const iat = claims?.iat
	const exp = claims?.exp
	if (typeof iat !== 'number' || typeof exp !== 'number' || !Number.isFinite(iat) || !Number.isFinite(exp)) {
		return REFRESH_BUFFER_MS
	}
	const lifetimeMs = (exp - iat) * 1000
	if (lifetimeMs <= 0) return REFRESH_BUFFER_MS
	return Math.min(REFRESH_BUFFER_MS, Math.floor(lifetimeMs / 2))
}

/**
 * How long a successful rotation stays available to late callers that still
 * hold the old refresh token (requests that were already in flight with the
 * previous session cookie, or a Server Component render whose refreshed cookie
 * could not be persisted). Without this, those callers would replay a rotated
 * refresh token and the backend would revoke every session of the user.
 */
const ROTATION_GRACE_MS = 2 * 60 * 1000

export const REFRESH_TOKEN_ERROR = 'RefreshTokenError' as const

export interface RefreshedTokens {
	accessToken: string
	refreshToken: string
	accessTokenExpires: number
}

export type RefreshResult = { ok: true; tokens: RefreshedTokens } | { ok: false }

/**
 * Map<refreshToken, Promise<result>> shared by every caller in this process.
 * Stored on globalThis so the separate Next.js bundles (route handlers, RSC,
 * the auth route) share a single instance instead of one per bundle.
 */
const STORE_KEY = Symbol.for('gestor.auth.refreshInFlight')

function getRefreshStore(): Map<string, Promise<RefreshResult>> {
	const holder = globalThis as unknown as Record<symbol, Map<string, Promise<RefreshResult>> | undefined>
	let store = holder[STORE_KEY]
	if (!store) {
		store = new Map()
		holder[STORE_KEY] = store
	}
	return store
}

async function callRefreshEndpoint(refreshToken: string): Promise<RefreshResult> {
	try {
		const response = await fetch(`${getBackendUrl()}/auth/refresh`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ refresh_token: refreshToken }),
			cache: 'no-store',
		})
		if (!response.ok) return { ok: false }

		const data = await response.json()
		if (typeof data?.access_token !== 'string' || !data.access_token) return { ok: false }

		const accessTokenExpires = getJwtExpiryMs(data.access_token) ?? Date.now() + (Number(data.expires_in) || 0) * 1000

		return {
			ok: true,
			tokens: {
				accessToken: data.access_token,
				refreshToken: typeof data.refresh_token === 'string' ? data.refresh_token : '',
				accessTokenExpires,
			},
		}
	} catch {
		return { ok: false }
	}
}

/**
 * Exchanges a refresh token for a new token pair. Concurrent callers with the
 * same refresh token share one backend call, and a successful result is kept
 * for a short grace period so late callers reuse it instead of replaying the
 * (already rotated) refresh token.
 */
export function refreshBackendTokens(refreshToken: string): Promise<RefreshResult> {
	const store = getRefreshStore()
	const existing = store.get(refreshToken)
	if (existing) return existing

	const pending = callRefreshEndpoint(refreshToken).then((result) => {
		if (result.ok) {
			const timer = setTimeout(() => {
				if (store.get(refreshToken) === pending) store.delete(refreshToken)
			}, ROTATION_GRACE_MS)
			;(timer as { unref?: () => void }).unref?.()
		} else {
			store.delete(refreshToken)
		}
		return result
	})

	store.set(refreshToken, pending)
	return pending
}

/** Test helper: forget every in-flight / cached rotation. */
export function resetRefreshStore() {
	getRefreshStore().clear()
}

function failedToken(token: JWT): JWT {
	return { ...token, accessToken: '', refreshToken: '', error: REFRESH_TOKEN_ERROR }
}

/**
 * True when the session's access token is valid and outside the refresh window,
 * i.e. `ensureFreshToken` (and therefore the next-auth `jwt` callback) would
 * return the token unchanged. Callers can then use `token.accessToken` as is,
 * without re-encoding the session cookie.
 */
export function hasFreshAccessToken(token: JWT): token is JWT & { accessToken: string } {
	if (token.error || typeof token.accessToken !== 'string' || !token.accessToken) return false
	const expiresAt = typeof token.accessTokenExpires === 'number' ? token.accessTokenExpires : 0
	return Date.now() < expiresAt - getRefreshBufferMs(token.accessToken)
}

/**
 * Returns a token whose backend access token is valid, refreshing it when it is
 * about to expire. This is the only place in the app that refreshes tokens; it
 * runs inside the next-auth `jwt` callback.
 */
export async function ensureFreshToken(token: JWT): Promise<JWT> {
	if (token.error) return token

	if (hasFreshAccessToken(token)) return token

	const expiresAt = typeof token.accessTokenExpires === 'number' ? token.accessTokenExpires : 0

	if (!token.refreshToken) {
		// No refresh token (demo sessions): usable until the access token expires.
		return token.accessToken && Date.now() < expiresAt ? token : failedToken(token)
	}

	const result = await refreshBackendTokens(token.refreshToken)
	if (!result.ok) return failedToken(token)

	return { ...token, ...result.tokens, error: undefined }
}
