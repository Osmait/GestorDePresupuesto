'use client'

import { SessionProvider, signOut, useSession } from 'next-auth/react'
import { ReactNode, useEffect } from 'react'

interface AuthSessionProviderProps {
	children: ReactNode
}

// Refresh interval: check session every 4 minutes.
// The JWT callback has a 5-minute buffer before expiration,
// so checking every 4 minutes ensures we refresh before it expires.
const SESSION_REFRESH_INTERVAL_MS = 4 * 60 * 1000

// Component that monitors session errors and triggers periodic refresh
function SessionErrorHandler({ children }: { children: ReactNode }) {
	const { data: session, update } = useSession()

	// Handle refresh token errors — sign out immediately
	useEffect(() => {
		if (session?.error === 'RefreshAccessTokenError') {
			console.warn('Session expired - refresh token failed. Signing out...')
			signOut({ callbackUrl: '/login' })
		}
	}, [session?.error])

	// Periodic session refresh — triggers the JWT callback which
	// checks expiration and refreshes the token if needed.
	useEffect(() => {
		const interval = setInterval(() => {
			update()
		}, SESSION_REFRESH_INTERVAL_MS)

		return () => clearInterval(interval)
	}, [update])

	// Refresh session when window regains focus (user returns to tab)
	useEffect(() => {
		const onFocus = () => update()
		window.addEventListener('focus', onFocus)
		return () => window.removeEventListener('focus', onFocus)
	}, [update])

	return <>{children}</>
}

export function AuthSessionProvider({ children }: AuthSessionProviderProps) {
	return (
		<SessionProvider refetchInterval={0} refetchOnWindowFocus={false}>
			<SessionErrorHandler>{children}</SessionErrorHandler>
		</SessionProvider>
	)
}
