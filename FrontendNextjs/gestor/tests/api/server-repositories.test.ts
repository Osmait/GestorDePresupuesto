// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

let localeCookie: string | undefined
vi.mock('next/headers', () => ({
	headers: async () => new Headers(),
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
})
