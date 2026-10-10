// @vitest-environment node
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { NextRequest } from 'next/server'
import type { JWT } from 'next-auth/jwt'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Proxy + real token refresh: the real `jwt`/`session` callbacks,
 * `ensureFreshToken` (dedupe + grace store) and `getBackendAccessToken`. Only
 * the cookie codec is emulated: the "cookie" holds the decoded token, and
 * auth() writes a Set-Cookie when the jwt callback returned a new token.
 */
let cookieToken: JWT | null = null
const decodeCalls = vi.fn()
const authCalls = vi.fn()

vi.mock('@/lib/auth/session-cookie', () => ({
	readSessionJwt: async () => {
		decodeCalls()
		return cookieToken ? { ...cookieToken } : null
	},
}))

vi.mock('@/auth', async () => {
	const { authConfig } = await import('@/lib/auth/config')
	return {
		auth: (handler: (req: any, ctx: any) => Promise<Response>) => async (req: any, ctx: any) => {
			authCalls()
			decodeCalls()
			const decoded = cookieToken ? { ...cookieToken } : null
			let session = null
			let rotated: JWT | null = null
			if (decoded) {
				const token = (await (authConfig.callbacks.jwt as any)({ token: decoded })) as JWT
				if (token.accessToken !== decoded.accessToken || token.error) rotated = token
				session = await (authConfig.callbacks.session as any)({
					session: { user: {}, expires: '2099-01-01T00:00:00.000Z' },
					token,
				})
			}
			const res = await handler(Object.assign(req, { auth: session }), ctx)
			// next-auth re-encodes the cookie on every auth() call; mark refreshes explicitly.
			res.headers.append('set-cookie', `authjs.session-token=${rotated ? 'rotated' : 'same'}; Path=/; HttpOnly`)
			return res
		},
	}
})

import { GET } from '@/app/api/backend/[...path]/route'
import { resetRefreshStore } from '@/lib/auth/token-refresh'

function makeJwt(expiresInSeconds: number, lifetimeSeconds = 24 * 60 * 60) {
	const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url')
	const exp = Math.floor(Date.now() / 1000) + expiresInSeconds
	return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ id: 'u1', iat: exp - lifetimeSeconds, exp })}.sig`
}

function sessionWithTokenExpiringIn(seconds: number, refreshToken = 'refresh-old'): JWT {
	const accessToken = makeJwt(seconds)
	return { id: 'u1', role: 'USER', accessToken, refreshToken, accessTokenExpires: Date.now() + seconds * 1000 }
}

const ctx = (path: string[]) => ({ params: Promise.resolve({ path }) })
const request = (path: string) =>
	GET(
		new NextRequest(`http://localhost:3000/api/backend/${path}`, {
			headers: { cookie: 'authjs.session-token=encrypted' },
		}),
		ctx(path.split('/')),
	) as Promise<Response>

describe('backend proxy with the real token refresh', () => {
	let server: http.Server
	let refreshCalls: number
	let refreshStatus: number
	let rotatedAccessToken: string
	let authorizations: string[]

	beforeEach(async () => {
		resetRefreshStore()
		decodeCalls.mockReset()
		authCalls.mockReset()
		refreshCalls = 0
		refreshStatus = 200
		authorizations = []
		rotatedAccessToken = makeJwt(24 * 60 * 60)
		server = http.createServer((req, res) => {
			if (req.url === '/auth/refresh') {
				refreshCalls += 1
				// Slow enough that concurrent requests overlap the in-flight refresh.
				setTimeout(() => {
					res.writeHead(refreshStatus, { 'content-type': 'application/json' })
					res.end(JSON.stringify({ access_token: rotatedAccessToken, refresh_token: 'refresh-new' }))
				}, 20)
				return
			}
			authorizations.push(String(req.headers.authorization))
			res.writeHead(200, { 'content-type': 'application/json' })
			res.end('[]')
		})
		await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
		process.env.BACKEND_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
	})

	afterEach(async () => {
		server.closeAllConnections()
		await new Promise<void>((resolve) => server.close(() => resolve()))
	})

	it('fresh token: one decode, no jwt callback, no refresh, no Set-Cookie', async () => {
		cookieToken = sessionWithTokenExpiringIn(60 * 60)

		const res = await request('account')

		expect(res.status).toBe(200)
		expect(res.headers.get('set-cookie')).toBeNull()
		expect(authCalls).not.toHaveBeenCalled()
		expect(decodeCalls).toHaveBeenCalledTimes(1)
		expect(refreshCalls).toBe(0)
		expect(authorizations).toEqual([`Bearer ${cookieToken.accessToken}`])
	})

	it('token inside the refresh window: refreshes once, forwards the rotated token and persists the cookie', async () => {
		cookieToken = sessionWithTokenExpiringIn(60)

		const res = await request('account')

		expect(res.status).toBe(200)
		expect(refreshCalls).toBe(1)
		expect(authCalls).toHaveBeenCalledTimes(1)
		expect(res.headers.get('set-cookie')).toContain('authjs.session-token=rotated')
		expect(authorizations).toEqual([`Bearer ${rotatedAccessToken}`])
	})

	it('a burst of 8 requests with the same expiring cookie triggers exactly one backend refresh', async () => {
		cookieToken = sessionWithTokenExpiringIn(60)

		const responses = await Promise.all(Array.from({ length: 8 }, () => request('account')))

		expect(responses.map((r) => r.status)).toEqual(Array(8).fill(200))
		expect(refreshCalls).toBe(1)
		expect(new Set(authorizations)).toEqual(new Set([`Bearer ${rotatedAccessToken}`]))
	})

	it('late requests still carrying the old cookie reuse the rotation (grace store) instead of replaying it', async () => {
		cookieToken = sessionWithTokenExpiringIn(60)
		await request('account')
		// Same (pre-rotation) cookie again, e.g. a request that was already in flight.
		const res = await request('category')

		expect(res.status).toBe(200)
		expect(refreshCalls).toBe(1)
		expect(authorizations).toEqual([`Bearer ${rotatedAccessToken}`, `Bearer ${rotatedAccessToken}`])
	})

	it('SSE stream on reload with an expired token: reuses the rotation already made by the page render, no 401', async () => {
		cookieToken = sessionWithTokenExpiringIn(-10)
		// The Server Component render (auth()) refreshes first; its cookie cannot be persisted.
		await request('account')
		authorizations.length = 0
		authCalls.mockReset()

		// The stream still carries the old, expired cookie.
		const res = (await GET(
			new NextRequest('http://localhost:3000/api/backend/notifications', {
				headers: { cookie: 'authjs.session-token=encrypted', accept: 'text/event-stream' },
			}),
			ctx(['notifications']),
		)) as Response

		expect(res.status).toBe(200)
		expect(refreshCalls).toBe(1)
		expect(authorizations).toEqual([`Bearer ${rotatedAccessToken}`])
		expect(authCalls).not.toHaveBeenCalled()
		expect(res.headers.get('set-cookie')).toBeNull()
		expect(res.headers.get('x-session-refreshed')).toBe('1')
		await res.body?.cancel()
	})

	it('concurrent stream and API calls with an expired cookie share one refresh', async () => {
		cookieToken = sessionWithTokenExpiringIn(-10)
		const stream = GET(
			new NextRequest('http://localhost:3000/api/backend/notifications', {
				headers: { cookie: 'authjs.session-token=encrypted', accept: 'text/event-stream' },
			}),
			ctx(['notifications']),
		) as Promise<Response>

		const responses = await Promise.all([stream, request('account'), request('category')])

		expect(responses.map((r) => r.status)).toEqual([200, 200, 200])
		expect(refreshCalls).toBe(1)
		expect(new Set(authorizations)).toEqual(new Set([`Bearer ${rotatedAccessToken}`]))
		await responses[0].body?.cancel()
	})

	it('expired token whose refresh fails: 401, the backend is never called with it', async () => {
		cookieToken = sessionWithTokenExpiringIn(-10)
		refreshStatus = 401

		const res = await request('account')

		expect(res.status).toBe(401)
		expect(await res.json()).toEqual({ error: 'RefreshTokenError' })
		expect(authorizations).toEqual([])
	})

	it('expired demo session (no refresh token): 401 without a refresh attempt', async () => {
		cookieToken = { ...sessionWithTokenExpiringIn(-10), refreshToken: '' }

		const res = await request('account')

		expect(res.status).toBe(401)
		expect(refreshCalls).toBe(0)
		expect(authorizations).toEqual([])
	})

	it('no session cookie: forwarded anonymously through auth()', async () => {
		cookieToken = null

		const res = await request('auth/demo')

		expect(res.status).toBe(200)
		expect(authCalls).toHaveBeenCalledTimes(1)
		expect(authorizations).toEqual(['undefined'])
	})
})
