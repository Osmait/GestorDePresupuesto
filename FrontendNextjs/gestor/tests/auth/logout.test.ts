// @vitest-environment node
import type { JWT } from 'next-auth/jwt'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { authConfig } from '@/lib/auth/config'
import { LOGOUT_TIMEOUT_MS } from '@/lib/auth/logout'
import { refreshBackendTokens, resetRefreshStore } from '@/lib/auth/token-refresh'

vi.mock('next/headers', () => ({
	headers: async () => {
		throw new Error('`headers` was called outside a request scope')
	},
}))

const BACKEND = 'http://backend.test'

function jsonResponse(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

function makeJwt(expiresInSeconds: number) {
	const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url')
	return `${encode({ alg: 'HS256' })}.${encode({ id: 'u1', exp: Math.floor(Date.now() / 1000) + expiresInSeconds })}.sig`
}

const signOutEvent = (message: { token: JWT | null } | { session: unknown }) =>
	(authConfig.events.signOut as (message: unknown) => Promise<void>)(message)

function sessionToken(overrides: Partial<JWT> = {}): JWT {
	return {
		id: 'u1',
		accessToken: 'access',
		refreshToken: 'refresh-1',
		accessTokenExpires: Date.now() + 60_000,
		...overrides,
	}
}

function logoutBodies(fetchMock: ReturnType<typeof vi.fn>) {
	return fetchMock.mock.calls
		.filter(([url]) => url === `${BACKEND}/auth/logout`)
		.map(([, init]) => JSON.parse((init as RequestInit).body as string))
}

describe('next-auth signOut event (backend logout)', () => {
	const fetchMock = vi.fn()
	const errorSpy = vi.spyOn(console, 'error')

	beforeEach(() => {
		process.env.BACKEND_URL = BACKEND
		resetRefreshStore()
		fetchMock.mockReset()
		errorSpy.mockReset().mockImplementation(() => {})
		vi.stubGlobal('fetch', fetchMock)
	})

	afterEach(() => {
		vi.unstubAllGlobals()
	})

	it("revokes the session's refresh token on the backend", async () => {
		fetchMock.mockResolvedValue(jsonResponse({ message: 'logged out successfully' }))

		await signOutEvent({ token: sessionToken() })

		expect(fetchMock).toHaveBeenCalledTimes(1)
		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
		expect(url).toBe(`${BACKEND}/auth/logout`)
		expect(init.method).toBe('POST')
		expect(init.headers).toMatchObject({ 'Content-Type': 'application/json' })
		expect(JSON.parse(init.body as string)).toEqual({ refresh_token: 'refresh-1' })
		// Bounded: a slow backend cannot hold the sign-out.
		expect(init.signal).toBeInstanceOf(AbortSignal)
		// Never the access token.
		expect(init.headers).not.toHaveProperty('Authorization')
	})

	it('skips the backend for sessions without a refresh token (demo, failed refresh)', async () => {
		await signOutEvent({ token: sessionToken({ refreshToken: '' }) })
		await signOutEvent({ token: sessionToken({ refreshToken: undefined }) })
		await signOutEvent({ token: null })
		await signOutEvent({ session: null })

		expect(fetchMock).not.toHaveBeenCalled()
	})

	it('never throws when the backend fails or is unreachable', async () => {
		fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'logout failed' }, 500))
		await expect(signOutEvent({ token: sessionToken() })).resolves.toBeUndefined()

		fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'))
		await expect(signOutEvent({ token: sessionToken() })).resolves.toBeUndefined()

		expect(errorSpy).toHaveBeenCalledTimes(2)
	})

	it('gives up after the timeout instead of hanging the sign-out', async () => {
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
		// AbortSignal.timeout is not driven by fake timers: emulate it with a faked setTimeout.
		const timeoutSpy = vi.spyOn(AbortSignal, 'timeout').mockImplementation((ms: number) => {
			const controller = new AbortController()
			setTimeout(() => controller.abort(new DOMException('timed out', 'TimeoutError')), ms)
			return controller.signal
		})
		try {
			fetchMock.mockImplementation(
				(_url: string, init: RequestInit) =>
					new Promise((_resolve, reject) => {
						init.signal?.addEventListener('abort', () => reject(init.signal?.reason))
					}),
			)

			const pending = signOutEvent({ token: sessionToken() })
			await vi.advanceTimersByTimeAsync(LOGOUT_TIMEOUT_MS)

			await expect(pending).resolves.toBeUndefined()
			expect(timeoutSpy).toHaveBeenCalledWith(LOGOUT_TIMEOUT_MS)
			expect(errorSpy).toHaveBeenCalledTimes(1)
		} finally {
			vi.useRealTimers()
			timeoutSpy.mockRestore()
		}
	})

	it('also revokes the token that replaced a just-rotated refresh token', async () => {
		fetchMock.mockImplementation(async (url: string) =>
			url.endsWith('/auth/refresh')
				? jsonResponse({ access_token: makeJwt(900), refresh_token: 'refresh-2', expires_in: 900 })
				: jsonResponse({ message: 'logged out successfully' }),
		)
		// The cookie missed this rotation and still carries refresh-1.
		await refreshBackendTokens('refresh-1', 'u1')

		await signOutEvent({ token: sessionToken() })

		expect(logoutBodies(fetchMock)).toEqual(
			expect.arrayContaining([{ refresh_token: 'refresh-1' }, { refresh_token: 'refresh-2' }]),
		)
	})

	it("does not revoke another user's rotation", async () => {
		fetchMock.mockImplementation(async (url: string) =>
			url.endsWith('/auth/refresh')
				? jsonResponse({ access_token: makeJwt(900), refresh_token: 'refresh-2', expires_in: 900 })
				: jsonResponse({ message: 'logged out successfully' }),
		)
		await refreshBackendTokens('refresh-1', 'u1')

		await signOutEvent({ token: sessionToken({ id: 'u2' }) })

		expect(logoutBodies(fetchMock)).toEqual([{ refresh_token: 'refresh-1' }])
	})
})
