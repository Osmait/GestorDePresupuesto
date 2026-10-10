// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let localeCookie: string | undefined
let incomingHeaders = new Headers()
vi.mock('next/headers', () => ({
	headers: async () => incomingHeaders,
	cookies: async () => ({
		get: (name: string) =>
			name === 'locale' && localeCookie !== undefined ? { name, value: localeCookie } : undefined,
	}),
}))

vi.mock('@/lib/auth/backend-token', () => ({
	getBackendAccessToken: async () => 'server-token',
}))

import { serverAccountRepository } from '@/lib/server/repositories'

describe('server repositories', () => {
	const fetchMock = vi.fn()

	beforeEach(() => {
		process.env.BACKEND_URL = 'http://backend.test'
		fetchMock.mockReset().mockImplementation(async () => Response.json([]))
		vi.stubGlobal('fetch', fetchMock)
	})

	afterEach(() => {
		vi.unstubAllGlobals()
		localeCookie = undefined
		incomingHeaders = new Headers()
		delete process.env.PROXY_SHARED_SECRET
	})

	it.each([
		['en', 'en'],
		['es', 'es'],
		[undefined, 'es'],
		['fr', 'es'],
	])('sends locale cookie %s to the backend as Accept-Language %s', async (cookie, expected) => {
		localeCookie = cookie
		await serverAccountRepository.findAll()

		const init = fetchMock.mock.calls[0][1] as RequestInit
		const headers = init.headers as Record<string, string>
		expect(headers['Accept-Language']).toBe(expected)
		expect(headers.Authorization).toBe('Bearer server-token')
	})

	it('sends the browser IP with the shared secret only when PROXY_SHARED_SECRET is set', async () => {
		incomingHeaders = new Headers({ 'x-forwarded-for': '198.51.100.9, 10.0.0.1' })
		await serverAccountRepository.findAll()
		let headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>
		expect(headers['X-Client-IP']).toBeUndefined()
		expect(headers['X-Proxy-Secret']).toBeUndefined()

		const secret = 'test-proxy-secret-'.padEnd(40, '0')
		process.env.PROXY_SHARED_SECRET = secret
		await serverAccountRepository.findAll()
		headers = (fetchMock.mock.calls[1][1] as RequestInit).headers as Record<string, string>
		expect(headers['X-Client-IP']).toBe('198.51.100.9')
		expect(headers['X-Proxy-Secret']).toBe(secret)
	})
})
