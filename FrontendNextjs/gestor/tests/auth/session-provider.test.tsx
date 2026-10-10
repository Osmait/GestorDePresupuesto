import { render } from '@testing-library/react'
import { useSession } from 'next-auth/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let pathname = '/app/accounts/acc-1'
vi.mock('next/navigation', () => ({
	usePathname: () => pathname,
}))

const signOutExpiredSessionMock = vi.fn(() => Promise.resolve())
vi.mock('@/lib/client-session', () => ({
	signOutExpiredSession: () => signOutExpiredSessionMock(),
}))

import {
	AuthSessionProvider,
	FOCUS_REFRESH_MIN_INTERVAL_MS,
	SESSION_REFRESH_INTERVAL_MS,
} from '@/components/auth/session-provider'

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

describe('AuthSessionProvider session re-checks', () => {
	let update: ReturnType<typeof vi.fn>

	beforeEach(() => {
		vi.useFakeTimers()
		pathname = '/app'
		update = vi.fn(() => Promise.resolve(null))
		vi.mocked(useSession).mockReturnValue({
			data: { user: { id: 'u1' }, expires: '' },
			status: 'authenticated',
			update,
		} as any)
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it('does not re-fetch the session on a focus right after the page loaded', () => {
		render(<AuthSessionProvider session={{ user: { id: 'u1' }, expires: '' } as any}>child</AuthSessionProvider>)

		window.dispatchEvent(new Event('focus'))

		expect(update).not.toHaveBeenCalled()
	})

	it('re-checks on focus once the last sync is older than the minimum interval', () => {
		render(<AuthSessionProvider>child</AuthSessionProvider>)

		vi.advanceTimersByTime(FOCUS_REFRESH_MIN_INTERVAL_MS)
		window.dispatchEvent(new Event('focus'))
		expect(update).toHaveBeenCalledTimes(1)

		// a second focus right after is skipped
		window.dispatchEvent(new Event('focus'))
		expect(update).toHaveBeenCalledTimes(1)
	})

	it('keeps the periodic refresh', () => {
		render(<AuthSessionProvider>child</AuthSessionProvider>)

		vi.advanceTimersByTime(SESSION_REFRESH_INTERVAL_MS)
		expect(update).toHaveBeenCalledTimes(1)
		vi.advanceTimersByTime(SESSION_REFRESH_INTERVAL_MS)
		expect(update).toHaveBeenCalledTimes(2)
	})
})
