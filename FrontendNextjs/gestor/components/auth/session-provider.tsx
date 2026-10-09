'use client'

import { usePathname } from 'next/navigation'
import { SessionProvider, useSession } from 'next-auth/react'
import { ReactNode, useEffect } from 'react'
import { isAuthPagePath } from '@/lib/auth/callback-url'
import { signOutExpiredSession } from '@/lib/client-session'

interface AuthSessionProviderProps {
	children: ReactNode
}

// Refresh interval: check session every 4 minutes.
// The JWT callback refreshes the access token min(5 min, 50% of its lifetime)
// before it expires; requests in between refresh it too.
const SESSION_REFRESH_INTERVAL_MS = 4 * 60 * 1000

// Component that monitors session errors and triggers periodic refresh
function SessionErrorHandler({ children }: { children: ReactNode }) {
	const { data: session, update } = useSession()
	const pathname = usePathname()
	const onAuthPage = isAuthPagePath(pathname)

	// The jwt callback sets session.error when the backend refresh fails — sign
	// out and come back to the current page after logging in again. Never on
	// /login or /register: the user is already there, and signing out again
	// would replace the deep callbackUrl with the default.
	useEffect(() => {
		if (session?.error === 'RefreshTokenError' && !onAuthPage) {
			void signOutExpiredSession()
		}
	}, [session?.error, onAuthPage])

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
