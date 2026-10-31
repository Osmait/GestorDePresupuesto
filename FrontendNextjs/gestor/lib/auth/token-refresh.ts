import 'server-only'
import type { JWT } from 'next-auth/jwt'
import { decodeJwtClaims, getJwtExpiryMs } from '@/lib/auth/jwt-utils'
import { getBackendUrl } from '@/lib/backend-url'
import { currentClientIpHeaders } from '@/lib/server/client-ip'

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
 *
 * Kept short (same as the backend's default refresh reuse grace): the cached
 * pair is a live token pair handed to anyone presenting the old refresh token.
 */
export const ROTATION_GRACE_MS = 30 * 1000

export const REFRESH_TOKEN_ERROR = 'RefreshTokenError' as const

export interface RefreshedTokens {
	accessToken: string
	refreshToken: string
	accessTokenExpires: number
}

export type RefreshResult = { ok: true; tokens: RefreshedTokens } | { ok: false }

/** A rotation in flight or in its grace period, bound to the user whose session started it. */
interface RefreshEntry {
	userId: string
	result: Promise<RefreshResult>
}

/**
 * Map<refreshToken, entry> shared by every caller in this process.
 * Stored on globalThis so the separate Next.js bundles (route handlers, RSC,
 * the auth route) share a single instance instead of one per bundle.
 */
const STORE_KEY = Symbol.for('gestor.auth.refreshInFlight')

function getRefreshStore(): Map<string, RefreshEntry> {
	const holder = globalThis as unknown as Record<symbol, Map<string, RefreshEntry> | undefined>
	let store = holder[STORE_KEY]
	if (!store) {
		store = new Map()
		holder[STORE_KEY] = store
	}
	return store
}

async function callRefreshEndpoint(refreshToken: string): Promise<RefreshResult> {
	try {
		// Runs inside the next-auth jwt callback (no request argument): the
		// browser's IP comes from next/headers when called within a request.
		const response = await fetch(`${getBackendUrl()}/auth/refresh`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', ...(await currentClientIpHeaders()) },
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
 *
 * The shared result is only handed to sessions of the same user (`userId`):
 * a session of another user presenting that refresh token gets a failure, and
 * the token is not replayed to the backend (that would revoke every session of
 * the user who rotated it).
 */
export function refreshBackendTokens(refreshToken: string, userId: string): Promise<RefreshResult> {
	const store = getRefreshStore()
	const existing = store.get(refreshToken)
	if (existing) return existing.userId === userId ? existing.result : Promise.resolve({ ok: false })

	const entry: RefreshEntry = {
		userId,
		result: callRefreshEndpoint(refreshToken).then((result) => {
			if (result.ok) {
				const timer = setTimeout(() => {
					if (store.get(refreshToken) === entry) store.delete(refreshToken)
				}, ROTATION_GRACE_MS)
				;(timer as { unref?: () => void }).unref?.()
			} else {
				store.delete(refreshToken)
			}
			return result
		}),
	}

	store.set(refreshToken, entry)
	return entry.result
}

/**
 * The refresh token that replaced `refreshToken` in this process, while the
 * rotation (started by `userId`'s session) is still in its grace period. Never
 * calls the backend. Used on sign-out: a cookie that missed the rotation still
 * carries the old token, and the one that replaced it must be revoked too.
 */
export async function getRotatedRefreshToken(refreshToken: string, userId: string): Promise<string | null> {
	const entry = getRefreshStore().get(refreshToken)
	if (!entry || entry.userId !== userId) return null
	const result = await entry.result
	return result.ok && result.tokens.refreshToken ? result.tokens.refreshToken : null
}

/** Test helper: forget every in-flight / cached rotation. */
export function resetRefreshStore() {
	getRefreshStore().clear()
}

/** The user a session belongs to, as stored in the cookie by the `jwt` callback at sign-in. */
export function sessionUserId(token: JWT): string {
	return typeof token.id === 'string' ? token.id : ''
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

	const result = await refreshBackendTokens(token.refreshToken, sessionUserId(token))
	if (!result.ok) return failedToken(token)

	return { ...token, ...result.tokens, error: undefined }
}
