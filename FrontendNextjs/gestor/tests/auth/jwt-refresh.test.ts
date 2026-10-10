// @vitest-environment node
import type { JWT } from 'next-auth/jwt'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { authConfig } from '@/lib/auth/config'
import { getRefreshBufferMs, REFRESH_BUFFER_MS, resetRefreshStore } from '@/lib/auth/token-refresh'

// The incoming request as seen through next/headers; null = outside a request scope.
let incomingHeaders: Headers | null = null
vi.mock('next/headers', () => ({
	headers: async () => {
		if (!incomingHeaders) throw new Error('`headers` was called outside a request scope')
		return incomingHeaders
	},
}))

const BACKEND = 'http://backend.test'
// Built at runtime: no secret-looking literal in the repo.
const PROXY_SECRET = 'test-proxy-secret-'.padEnd(40, '0')

function makeJwt(expiresInSeconds: number, id = 'u1') {
	const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url')
	const exp = Math.floor(Date.now() / 1000) + expiresInSeconds
	return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ id, exp })}.signature`
}

function jsonResponse(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

const jwtCallback = (token: JWT, user?: unknown) => (authConfig.callbacks.jwt as any)({ token, user }) as Promise<JWT>
const sessionCallback = (token: JWT) =>
	(authConfig.callbacks.session as any)({
		session: { user: { name: 'John', email: 'john@test.com' }, expires: '2099-01-01T00:00:00.000Z' },
		token,
	})

function provider(id: string) {
	const found = authConfig.providers.find((p: any) => p.options?.id === id || (id === 'credentials' && !p.options?.id))
	return (found as any).options as {
		authorize: (credentials: Record<string, unknown>, request?: Request) => Promise<unknown>
	}
}

function expiringToken(): JWT {
	return {
		id: 'u1',
		role: 'USER',
		lastName: 'Doe',
		accessToken: makeJwt(60),
		refreshToken: 'refresh-old',
		// inside the 5 minute refresh buffer
		accessTokenExpires: Date.now() + 60 * 1000,
	}
}

describe('next-auth jwt callback token refresh', () => {
	const fetchMock = vi.fn()

	beforeEach(() => {
		process.env.BACKEND_URL = BACKEND
		resetRefreshStore()
		fetchMock.mockReset()
		vi.stubGlobal('fetch', fetchMock)
	})

	afterEach(() => {
		vi.unstubAllGlobals()
	})

	it('returns the token untouched while the access token is fresh', async () => {
		const token: JWT = { ...expiringToken(), accessTokenExpires: Date.now() + 60 * 60 * 1000 }
		await expect(jwtCallback(token)).resolves.toBe(token)
		expect(fetchMock).not.toHaveBeenCalled()
	})

	it('dedupes concurrent refreshes: N callers -> 1 backend refresh', async () => {
		const newAccess = makeJwt(15 * 60)
		let release: (value: Response) => void = () => {}
		fetchMock.mockImplementation(
			() =>
				new Promise<Response>((resolve) => {
					release = resolve
				}),
		)

		const token = expiringToken()
		const pending = Array.from({ length: 6 }, () => jwtCallback({ ...token }))
		await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled())
		release(jsonResponse({ access_token: newAccess, refresh_token: 'refresh-new', expires_in: 900 }))
		const results = await Promise.all(pending)

		expect(fetchMock).toHaveBeenCalledTimes(1)
		expect(fetchMock).toHaveBeenCalledWith(
			`${BACKEND}/auth/refresh`,
			expect.objectContaining({ method: 'POST', body: JSON.stringify({ refresh_token: 'refresh-old' }) }),
		)
		for (const result of results) {
			expect(result.accessToken).toBe(newAccess)
			expect(result.refreshToken).toBe('refresh-new')
			expect(result.error).toBeUndefined()
			// expiry comes from the new token's exp claim
			expect(result.accessTokenExpires).toBeGreaterThan(Date.now() + 14 * 60 * 1000)
		}
	})

	describe('client IP (PROXY_SHARED_SECRET)', () => {
		afterEach(() => {
			incomingHeaders = null
			delete process.env.PROXY_SHARED_SECRET
		})

		function refreshHeaders() {
			return (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>
		}

		it('sends the browser IP of the current request with the refresh', async () => {
			process.env.PROXY_SHARED_SECRET = PROXY_SECRET
			incomingHeaders = new Headers({ 'x-real-ip': '198.51.100.9' })
			fetchMock.mockResolvedValue(jsonResponse({ access_token: makeJwt(15 * 60), refresh_token: 'refresh-new' }))

			await jwtCallback(expiringToken())
			expect(refreshHeaders()).toMatchObject({ 'X-Client-IP': '198.51.100.9', 'X-Proxy-Secret': PROXY_SECRET })
		})

		it('sends neither header outside a request scope', async () => {
			process.env.PROXY_SHARED_SECRET = PROXY_SECRET
			fetchMock.mockResolvedValue(jsonResponse({ access_token: makeJwt(15 * 60), refresh_token: 'refresh-new' }))

			await jwtCallback(expiringToken())
			expect(refreshHeaders()['X-Client-IP']).toBeUndefined()
			expect(refreshHeaders()['X-Proxy-Secret']).toBeUndefined()
		})
	})

	it('serves late callers holding the rotated refresh token from the same result', async () => {
		fetchMock.mockResolvedValueOnce(
			jsonResponse({ access_token: makeJwt(900), refresh_token: 'refresh-new', expires_in: 900 }),
		)

		const first = await jwtCallback(expiringToken())
		const late = await jwtCallback(expiringToken())

		expect(fetchMock).toHaveBeenCalledTimes(1)
		expect(late.refreshToken).toBe(first.refreshToken)
	})

	it('flags the session with RefreshTokenError when the refresh fails', async () => {
		fetchMock.mockResolvedValue(jsonResponse({ error: 'refresh token reuse detected' }, 401))

		const results = await Promise.all([jwtCallback(expiringToken()), jwtCallback(expiringToken())])

		expect(fetchMock).toHaveBeenCalledTimes(1)
		for (const result of results) {
			expect(result.error).toBe('RefreshTokenError')
			expect(result.accessToken).toBe('')
			expect(result.refreshToken).toBe('')
		}

		const session = await sessionCallback(results[0])
		expect(session.error).toBe('RefreshTokenError')

		// Once failed, the callback does not retry the refresh.
		await jwtCallback(results[0])
		expect(fetchMock).toHaveBeenCalledTimes(1)
	})

	it('never exposes backend tokens in the session object', async () => {
		const session = await sessionCallback({ ...expiringToken(), name: 'John' })

		expect(session.user).toMatchObject({ id: 'u1', lastName: 'Doe', role: 'USER' })
		const serialized = JSON.stringify(session)
		expect(serialized).not.toContain('refresh-old')
		expect(session).not.toHaveProperty('accessToken')
		expect(session).not.toHaveProperty('refreshToken')
	})
})

function makeJwtWithLifetime(lifetimeSeconds: number, remainingSeconds: number) {
	const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url')
	const now = Math.floor(Date.now() / 1000)
	const exp = now + remainingSeconds
	const iat = exp - lifetimeSeconds
	return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ id: 'u1', iat, exp })}.signature`
}

describe('refresh buffer', () => {
	const fetchMock = vi.fn()

	beforeEach(() => {
		process.env.BACKEND_URL = BACKEND
		resetRefreshStore()
		fetchMock.mockReset()
		vi.stubGlobal('fetch', fetchMock)
	})

	afterEach(() => {
		vi.unstubAllGlobals()
	})

	it('is min(5 min, 50% of the token lifetime)', () => {
		expect(getRefreshBufferMs(makeJwtWithLifetime(60, 60))).toBe(30 * 1000)
		expect(getRefreshBufferMs(makeJwtWithLifetime(15 * 60, 15 * 60))).toBe(REFRESH_BUFFER_MS)
		expect(getRefreshBufferMs(makeJwtWithLifetime(8 * 60, 8 * 60))).toBe(4 * 60 * 1000)
	})

	it('falls back to the 5 minute cap when the lifetime is unknown', () => {
		expect(getRefreshBufferMs(makeJwt(60))).toBe(REFRESH_BUFFER_MS)
		expect(getRefreshBufferMs('not-a-jwt')).toBe(REFRESH_BUFFER_MS)
		expect(getRefreshBufferMs(undefined)).toBe(REFRESH_BUFFER_MS)
	})

	it('does not rotate a short-lived token on every request', async () => {
		// 60s token issued 10s ago: still outside its 30s buffer.
		const accessToken = makeJwtWithLifetime(60, 50)
		const token: JWT = {
			id: 'u1',
			accessToken,
			refreshToken: 'refresh-old',
			accessTokenExpires: Date.now() + 50 * 1000,
		}

		await expect(jwtCallback(token)).resolves.toBe(token)
		expect(fetchMock).not.toHaveBeenCalled()
	})

	it('refreshes a short-lived token once it enters the last half of its lifetime', async () => {
		fetchMock.mockResolvedValue(
			jsonResponse({ access_token: makeJwtWithLifetime(60, 60), refresh_token: 'refresh-new', expires_in: 60 }),
		)
		const token: JWT = {
			id: 'u1',
			accessToken: makeJwtWithLifetime(60, 20),
			refreshToken: 'refresh-old',
			accessTokenExpires: Date.now() + 20 * 1000,
		}

		const result = await jwtCallback(token)

		expect(fetchMock).toHaveBeenCalledTimes(1)
		expect(result.refreshToken).toBe('refresh-new')
	})
})

describe('credentials providers', () => {
	const fetchMock = vi.fn()

	beforeEach(() => {
		process.env.BACKEND_URL = BACKEND
		fetchMock.mockReset()
		vi.stubGlobal('fetch', fetchMock)
	})

	afterEach(() => {
		vi.unstubAllGlobals()
	})

	it('passkey login derives expiry from the JWT exp claim, ignoring client values', async () => {
		const access = makeJwt(15 * 60)
		fetchMock.mockResolvedValue(jsonResponse({ id: 'u1', email: 'a@b.c', name: 'A', last_name: 'B', role: 'USER' }))

		const user = (await provider('passkey').authorize({
			accessToken: access,
			refreshToken: 'r1',
			expiresIn: String(10 * 365 * 24 * 3600),
		})) as any

		expect(user.accessTokenExpires).toBeLessThanOrEqual(Date.now() + 15 * 60 * 1000)
		expect(user.accessTokenExpires).toBeGreaterThan(Date.now() + 14 * 60 * 1000)
	})

	it('rejects demo tokens the backend does not accept', async () => {
		fetchMock.mockResolvedValue(jsonResponse({ error: 'unauthorized' }, 401))

		await expect(provider('credentials').authorize({ demoToken: makeJwt(3600) })).resolves.toBeNull()
		expect(fetchMock).toHaveBeenCalledWith(
			`${BACKEND}/profile`,
			expect.objectContaining({
				headers: expect.objectContaining({ Authorization: expect.stringMatching(/^Bearer /) }),
			}),
		)
	})

	it('rejects malformed or expired demo tokens without creating a session', async () => {
		await expect(provider('credentials').authorize({ demoToken: 'not-a-jwt' })).resolves.toBeNull()
		await expect(provider('credentials').authorize({ demoToken: makeJwt(-10) })).resolves.toBeNull()
		expect(fetchMock).not.toHaveBeenCalled()
	})

	it('accepts a demo token verified by the backend profile endpoint', async () => {
		fetchMock.mockResolvedValue(jsonResponse({ id: 'demo-1', email: 'demo@x', name: 'Demo', last_name: 'User' }))

		const user = (await provider('credentials').authorize({ demoToken: makeJwt(3600, 'demo-1') })) as any
		expect(user).toMatchObject({ id: 'demo-1', role: 'USER', refreshToken: '' })
	})

	describe('client IP (PROXY_SHARED_SECRET)', () => {
		const signInRequest = () =>
			new Request('http://localhost:3000/api/auth/callback/credentials', {
				method: 'POST',
				headers: { 'x-forwarded-for': '198.51.100.9, 10.0.0.1' },
			})
		const sentHeaders = (index: number) =>
			(fetchMock.mock.calls[index][1] as RequestInit).headers as Record<string, string>

		afterEach(() => {
			delete process.env.PROXY_SHARED_SECRET
		})

		it('password login sends the browser IP with the secret to /auth/login and /profile', async () => {
			process.env.PROXY_SHARED_SECRET = PROXY_SECRET
			fetchMock
				.mockResolvedValueOnce(jsonResponse({ access_token: makeJwt(15 * 60), refresh_token: 'r1' }))
				.mockResolvedValueOnce(jsonResponse({ id: 'u1', email: 'a@b.c', name: 'A', last_name: 'B' }))

			const user = await provider('credentials').authorize(
				{ email: 'ana@example.com', password: 'pw' },
				signInRequest(),
			)
			expect(user).toMatchObject({ id: 'u1' })
			expect(fetchMock.mock.calls[0][0]).toBe(`${BACKEND}/auth/login`)
			expect(fetchMock.mock.calls[1][0]).toBe(`${BACKEND}/profile`)
			for (const index of [0, 1]) {
				expect(sentHeaders(index)).toMatchObject({ 'X-Client-IP': '198.51.100.9', 'X-Proxy-Secret': PROXY_SECRET })
			}
		})

		it('demo and passkey sign-ins send the browser IP with the profile check', async () => {
			process.env.PROXY_SHARED_SECRET = PROXY_SECRET
			fetchMock.mockImplementation(async () => jsonResponse({ id: 'u1', email: 'a@b.c', name: 'A', last_name: 'B' }))

			await provider('credentials').authorize({ demoToken: makeJwt(3600) }, signInRequest())
			await provider('passkey').authorize({ accessToken: makeJwt(3600), refreshToken: 'r1' }, signInRequest())
			expect(sentHeaders(0)['X-Client-IP']).toBe('198.51.100.9')
			expect(sentHeaders(1)['X-Client-IP']).toBe('198.51.100.9')
		})

		it('sends neither header without PROXY_SHARED_SECRET', async () => {
			fetchMock
				.mockResolvedValueOnce(jsonResponse({ access_token: makeJwt(15 * 60), refresh_token: 'r1' }))
				.mockResolvedValueOnce(jsonResponse({ id: 'u1', email: 'a@b.c', name: 'A', last_name: 'B' }))

			await provider('credentials').authorize({ email: 'ana@example.com', password: 'pw' }, signInRequest())
			expect(sentHeaders(0)['X-Client-IP']).toBeUndefined()
			expect(sentHeaders(0)['X-Proxy-Secret']).toBeUndefined()
		})
	})
})
