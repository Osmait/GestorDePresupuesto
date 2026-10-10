'use client'

import { usePathname } from 'next/navigation'
import type { Session } from 'next-auth'
import { SessionProvider, useSession } from 'next-auth/react'
import { ReactNode, useEffect, useRef } from 'react'
import { isAuthPagePath } from '@/lib/auth/callback-url'
import { signOutExpiredSession } from '@/lib/client-session'

interface AuthSessionProviderProps {
	children: ReactNode
	/**
	 * Session resolved by the server render. With it the provider starts
	 * authenticated (or signed out) without fetching /api/auth/session on mount.
	 */
	session?: Session | null
}

// Refresh interval: check session every 4 minutes.
// The JWT callback refreshes the access token min(5 min, 50% of its lifetime)
// before it expires; requests in between refresh it too.
export const SESSION_REFRESH_INTERVAL_MS = 4 * 60 * 1000

// Focus re-checks are skipped when the session was synced less than this long
// ago (page load, quick tab switches): the server just validated it, and every
// API call refreshes the token when needed.
export const FOCUS_REFRESH_MIN_INTERVAL_MS = 60 * 1000

// Component that monitors session errors and triggers periodic refresh
function SessionErrorHandler({ children }: { children: ReactNode }) {
	const { data: session, update } = useSession()
	const pathname = usePathname()
	const onAuthPage = isAuthPagePath(pathname)
	const updateRef = useRef(update)
	updateRef.current = update
	const lastSyncRef = useRef(Date.now())

	// The jwt callback sets session.error when the backend refresh fails — sign
	// out and come back to the current page after logging in again. Never on
	// /login or /register: the user is already there, and signing out again
	// would replace the deep callbackUrl with the default.
	useEffect(() => {
		if (session?.error === 'RefreshTokenError' && !onAuthPage) {
			void signOutExpiredSession()
		}
	}, [session?.error, onAuthPage])

	useEffect(() => {
		const refresh = () => {
			lastSyncRef.current = Date.now()
			void updateRef.current()
		}

		// Periodic session refresh — triggers the JWT callback which
		// checks expiration and refreshes the token if needed.
		const interval = setInterval(refresh, SESSION_REFRESH_INTERVAL_MS)

		// Refresh session when window regains focus (user returns to tab), unless
		// it was synced moments ago. Timers are throttled in background tabs, so
		// this is what catches a session that expired while the tab was hidden.
		const onFocus = () => {
			if (Date.now() - lastSyncRef.current >= FOCUS_REFRESH_MIN_INTERVAL_MS) refresh()
		}
		window.addEventListener('focus', onFocus)

		return () => {
			clearInterval(interval)
			window.removeEventListener('focus', onFocus)
		}
	}, [])

	return <>{children}</>
}

export function AuthSessionProvider({ children, session }: AuthSessionProviderProps) {
	return (
		<SessionProvider session={session} refetchInterval={0} refetchOnWindowFocus={false}>
			<SessionErrorHandler>{children}</SessionErrorHandler>
		</SessionProvider>
	)
}
