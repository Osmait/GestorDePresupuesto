'use client'

import { SessionProvider, signOut, useSession } from 'next-auth/react'
import { ReactNode, useEffect } from 'react'

interface AuthSessionProviderProps {
	children: ReactNode
}

// Component that monitors session errors and handles automatic signout
function SessionErrorHandler({ children }: { children: ReactNode }) {
	const { data: session } = useSession()

	useEffect(() => {
		if (session?.error === 'RefreshAccessTokenError') {
			// Token refresh failed - sign out the user
			console.warn('Session expired - refresh token failed. Signing out...')
			signOut({ callbackUrl: '/login' })
		}
	}, [session?.error])

	return <>{children}</>
}

export function AuthSessionProvider({ children }: AuthSessionProviderProps) {
	return (
		<SessionProvider>
			<SessionErrorHandler>{children}</SessionErrorHandler>
		</SessionProvider>
	)
}
