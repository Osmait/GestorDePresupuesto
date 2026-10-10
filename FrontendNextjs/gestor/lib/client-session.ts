import { getSession, signOut } from 'next-auth/react'
import {
	buildLoginUrl,
	getCurrentPathFromLocation,
	isAuthPagePath,
	SESSION_EXPIRED_REASON,
} from '@/lib/auth/callback-url'

/**
 * Called right before the user is signed out because the session expired.
 * Return `true` when the listener showed a message to the user (the redirect
 * is then delayed briefly so the message can be read).
 */
export type SessionExpiredListener = () => boolean | undefined

const sessionExpiredListeners = new Set<SessionExpiredListener>()

/** How long the session-expired message stays visible before redirecting to /login. */
export const SESSION_EXPIRED_REDIRECT_DELAY_MS = 1500

/**
 * Lets UI that holds unsaved input (an open form) persist it before the
 * session-expired redirect. Returns an unsubscribe function.
 */
export function onSessionExpired(listener: SessionExpiredListener): () => void {
	sessionExpiredListeners.add(listener)
	return () => {
		sessionExpiredListeners.delete(listener)
	}
}

/**
 * Single flight for the whole page lifetime: `signOut` ends with a full-page
 * navigation to /login, so once started it is never re-run from this page
 * (re-renders, 401s or session polls that still see the dead session would
 * otherwise sign out again and lose the return path). Reset only on failure.
 */
let expiredSignOut: Promise<void> | null = null

/**
 * Signs the user out after the session died (refresh token rejected) and sends
 * them to `/login?callbackUrl=<current page>&reason=session_expired`, so they
 * come back to where they were after signing in again. Idempotent, and a no-op
 * on the auth pages themselves: the user is already there, and the URL keeps
 * the original `callbackUrl` (re-deriving it from /login would reset it to /app).
 */
export function signOutExpiredSession(): Promise<void> {
	if (expiredSignOut) return expiredSignOut
	if (typeof window !== 'undefined' && isAuthPagePath(window.location.pathname)) return Promise.resolve()

	const returnPath = getCurrentPathFromLocation()
	expiredSignOut = (async () => {
		let messageShown = false
		sessionExpiredListeners.forEach((listener) => {
			try {
				if (listener() === true) messageShown = true
			} catch {
				// a failing listener must not block the sign-out
			}
		})
		if (messageShown) {
			await new Promise((resolve) => setTimeout(resolve, SESSION_EXPIRED_REDIRECT_DELAY_MS))
		}
		await signOut({ callbackUrl: buildLoginUrl(returnPath, SESSION_EXPIRED_REASON) })
	})()
	expiredSignOut.catch(() => {
		expiredSignOut = null
	})
	return expiredSignOut
}

/** Test-only: forget a previous expired-session sign-out. */
export function resetExpiredSessionSignOutForTests() {
	expiredSignOut = null
}

let inFlightRecovery: Promise<boolean> | null = null

/**
 * Called when the backend proxy answers 401. Re-fetches the session once (the
 * next-auth `jwt` callback refreshes the backend token if possible); concurrent
 * 401s share that single re-fetch. If the session is gone or its refresh
 * failed, the user is signed out. Never refreshes tokens itself.
 */
export function recoverSessionAfterUnauthorized(): Promise<boolean> {
	if (!inFlightRecovery) {
		inFlightRecovery = (async () => {
			try {
				const session = await getSession()
				if (session && !session.error) return true
			} catch {
				// fall through to sign-out
			}
			await signOutExpiredSession()
			return false
		})().finally(() => {
			inFlightRecovery = null
		})
	}
	return inFlightRecovery
}
