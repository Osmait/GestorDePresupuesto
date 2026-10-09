import { getSession, signOut } from 'next-auth/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildLoginUrl, getSafeCallbackUrl, isAuthPagePath, SESSION_EXPIRED_REASON } from '@/lib/auth/callback-url'
import {
	onSessionExpired,
	recoverSessionAfterUnauthorized,
	resetExpiredSessionSignOutForTests,
	SESSION_EXPIRED_REDIRECT_DELAY_MS,
	signOutExpiredSession,
} from '@/lib/client-session'

describe('buildLoginUrl', () => {
	it('keeps the return path and query and flags the expired session', () => {
		const url = new URL(buildLoginUrl('/app/transactions?page=2&sortBy=amount', SESSION_EXPIRED_REASON), 'http://x')
		expect(url.pathname).toBe('/login')
		expect(url.searchParams.get('callbackUrl')).toBe('/app/transactions?page=2&sortBy=amount')
		expect(url.searchParams.get('reason')).toBe('session_expired')
	})

	it('never builds an open redirect', () => {
		for (const target of ['https://evil.test', '//evil.test', '/\\evil.test', '/login?x=1']) {
			const url = new URL(buildLoginUrl(target), 'http://x')
			expect(url.searchParams.get('callbackUrl')).toBe(getSafeCallbackUrl(null))
			expect(url.searchParams.get('reason')).toBeNull()
		}
	})
})

describe('session-expired sign-out', () => {
	beforeEach(() => {
		resetExpiredSessionSignOutForTests()
		vi.mocked(getSession).mockReset()
		vi.mocked(signOut)
			.mockReset()
			.mockResolvedValue(undefined as never)
		window.history.replaceState(null, '', '/app/transactions?page=3')
	})

	afterEach(() => {
		vi.useRealTimers()
		window.history.replaceState(null, '', '/')
	})

	it('redirects to /login with the current page as callbackUrl', async () => {
		vi.mocked(getSession).mockResolvedValue({ user: { id: 'u1' }, expires: '', error: 'RefreshTokenError' } as any)

		await expect(recoverSessionAfterUnauthorized()).resolves.toBe(false)

		expect(signOut).toHaveBeenCalledTimes(1)
		const { callbackUrl } = vi.mocked(signOut).mock.calls[0][0] as { callbackUrl: string }
		const url = new URL(callbackUrl, 'http://x')
		expect(url.pathname).toBe('/login')
		expect(url.searchParams.get('callbackUrl')).toBe('/app/transactions?page=3')
		expect(url.searchParams.get('reason')).toBe(SESSION_EXPIRED_REASON)
	})

	it('lets listeners save drafts first and delays the redirect when they show a message', async () => {
		vi.useFakeTimers()
		const order: string[] = []
		const unsubscribe = onSessionExpired(() => {
			order.push('listener')
			return true
		})
		vi.mocked(signOut).mockImplementation(async () => {
			order.push('signOut')
			return undefined as never
		})

		const pending = signOutExpiredSession()
		await vi.advanceTimersByTimeAsync(SESSION_EXPIRED_REDIRECT_DELAY_MS - 1)
		expect(order).toEqual(['listener'])
		await vi.advanceTimersByTimeAsync(1)
		await pending
		expect(order).toEqual(['listener', 'signOut'])
		unsubscribe()
	})

	it('signs out once for concurrent expirations and survives failing listeners', async () => {
		const unsubscribe = onSessionExpired(() => {
			throw new Error('boom')
		})

		await Promise.all([signOutExpiredSession(), signOutExpiredSession()])

		expect(signOut).toHaveBeenCalledTimes(1)
		unsubscribe()
	})

	it('stays idempotent after the first sign-out finished (later triggers keep the deep return path)', async () => {
		window.history.replaceState(null, '', '/app/accounts/acc-1?x=1')
		vi.mocked(getSession).mockResolvedValue({ user: { id: 'u1' }, expires: '', error: 'RefreshTokenError' } as any)

		await signOutExpiredSession()
		await recoverSessionAfterUnauthorized()
		await signOutExpiredSession()

		expect(signOut).toHaveBeenCalledTimes(1)
		const { callbackUrl } = vi.mocked(signOut).mock.calls[0][0] as { callbackUrl: string }
		expect(new URL(callbackUrl, 'http://x').searchParams.get('callbackUrl')).toBe('/app/accounts/acc-1?x=1')
	})

	it('retries after a failed sign-out', async () => {
		vi.mocked(signOut).mockRejectedValueOnce(new Error('network'))

		await expect(signOutExpiredSession()).rejects.toThrow('network')
		await signOutExpiredSession()

		expect(signOut).toHaveBeenCalledTimes(2)
	})

	it('never signs out again on /login or /register', async () => {
		for (const path of ['/login?callbackUrl=%2Fapp%2Faccounts%2Facc-1%3Fx%3D1&reason=session_expired', '/register']) {
			window.history.replaceState(null, '', path)
			await signOutExpiredSession()
		}

		expect(signOut).not.toHaveBeenCalled()
	})
})

describe('isAuthPagePath', () => {
	it('matches only the auth pages', () => {
		expect(isAuthPagePath('/login')).toBe(true)
		expect(isAuthPagePath('/register')).toBe(true)
		expect(isAuthPagePath('/login/')).toBe(true)
		expect(isAuthPagePath('/app/login')).toBe(false)
		expect(isAuthPagePath('/loginx')).toBe(false)
		expect(isAuthPagePath(null)).toBe(false)
	})
})
