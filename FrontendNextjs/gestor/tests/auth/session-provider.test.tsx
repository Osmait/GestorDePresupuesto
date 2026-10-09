import { render } from '@testing-library/react'
import { useSession } from 'next-auth/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

let pathname = '/app/accounts/acc-1'
vi.mock('next/navigation', () => ({
	usePathname: () => pathname,
}))

const signOutExpiredSessionMock = vi.fn(() => Promise.resolve())
vi.mock('@/lib/client-session', () => ({
	signOutExpiredSession: () => signOutExpiredSessionMock(),
}))

import { AuthSessionProvider } from '@/components/auth/session-provider'

function mockSession(error?: string) {
	vi.mocked(useSession).mockReturnValue({
		data: { user: { id: 'u1' }, expires: '', error },
		status: 'authenticated',
		update: vi.fn(),
	} as any)
}

describe('AuthSessionProvider expired-session handling', () => {
	beforeEach(() => {
		signOutExpiredSessionMock.mockClear()
	})

	it('signs out when the refresh token died on an app page', () => {
		pathname = '/app/accounts/acc-1'
		mockSession('RefreshTokenError')
		render(<AuthSessionProvider>child</AuthSessionProvider>)
		expect(signOutExpiredSessionMock).toHaveBeenCalledTimes(1)
	})

	it('does not sign out again on /login or /register', () => {
		for (const path of ['/login', '/register']) {
			pathname = path
			mockSession('RefreshTokenError')
			const { unmount } = render(<AuthSessionProvider>child</AuthSessionProvider>)
			unmount()
		}
		expect(signOutExpiredSessionMock).not.toHaveBeenCalled()
	})

	it('does nothing for a healthy session', () => {
		pathname = '/app'
		mockSession()
		render(<AuthSessionProvider>child</AuthSessionProvider>)
		expect(signOutExpiredSessionMock).not.toHaveBeenCalled()
	})
})
