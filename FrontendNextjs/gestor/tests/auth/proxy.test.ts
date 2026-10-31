// @vitest-environment node
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const getTokenMock = vi.fn()

vi.mock('next-auth/jwt', () => ({
	getToken: (...args: unknown[]) => getTokenMock(...args),
}))

import { config, proxy } from '@/proxy'

const SESSION_COOKIE = 'authjs.session-token=encrypted'

function request(path: string, cookie?: string) {
	return new NextRequest(`http://localhost:3000${path}`, {
		headers: cookie ? { cookie } : {},
	})
}

function sessionToken(overrides: Record<string, unknown> = {}) {
	return {
		id: 'u1',
		role: 'USER',
		accessToken: 'access',
		refreshToken: 'refresh',
		accessTokenExpires: Date.now() + 60 * 60 * 1000,
		...overrides,
	}
}

describe('proxy', () => {
	beforeEach(() => {
		process.env.AUTH_SECRET = 'test-secret'
		getTokenMock.mockReset()
	})

	it('protects both /app and /admin', () => {
		expect(config.matcher).toEqual(expect.arrayContaining(['/app/:path*', '/admin/:path*']))
	})

	it('redirects unauthenticated requests to /login with a callbackUrl', async () => {
		const res = await proxy(request('/app/transactions?page=2'))

		expect(res.status).toBe(307)
		const location = new URL(res.headers.get('location') ?? '')
		expect(location.pathname).toBe('/login')
		expect(location.searchParams.get('callbackUrl')).toBe('/app/transactions?page=2')
		expect(getTokenMock).not.toHaveBeenCalled()
	})

	it('redirects unauthenticated admin requests to /login', async () => {
		getTokenMock.mockResolvedValue(null)
		const res = await proxy(request('/admin/dashboard', SESSION_COOKIE))

		const location = new URL(res.headers.get('location') ?? '')
		expect(location.pathname).toBe('/login')
		expect(location.searchParams.get('callbackUrl')).toBe('/admin/dashboard')
	})

	it('treats a session whose refresh failed as unauthenticated', async () => {
		getTokenMock.mockResolvedValue(sessionToken({ error: 'RefreshTokenError' }))
		const res = await proxy(request('/app', SESSION_COOKIE))

		expect(new URL(res.headers.get('location') ?? '').pathname).toBe('/login')
	})

	it('redirects non-admin users away from /admin', async () => {
		getTokenMock.mockResolvedValue(sessionToken({ role: 'USER' }))
		const res = await proxy(request('/admin/dashboard', SESSION_COOKIE))

		expect(res.status).toBe(307)
		expect(new URL(res.headers.get('location') ?? '').pathname).toBe('/app')
	})

	it('lets admins into /admin', async () => {
		getTokenMock.mockResolvedValue(sessionToken({ role: 'ADMIN' }))
		const res = await proxy(request('/admin/dashboard', SESSION_COOKIE))

		expect(res.headers.get('location')).toBeNull()
		expect(res.headers.get('x-middleware-next')).toBe('1')
	})

	it('lets authenticated users into /app without refreshing tokens', async () => {
		const fetchSpy = vi.spyOn(globalThis, 'fetch')
		getTokenMock.mockResolvedValue(sessionToken({ accessTokenExpires: Date.now() - 1000 }))
		const res = await proxy(request('/app', SESSION_COOKIE))

		expect(res.headers.get('x-middleware-next')).toBe('1')
		expect(fetchSpy).not.toHaveBeenCalled()
		fetchSpy.mockRestore()
	})
})
