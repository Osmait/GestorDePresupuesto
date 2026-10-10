// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'

let incomingHeaders: Headers | null = null
vi.mock('next/headers', () => ({
	headers: async () => {
		if (!incomingHeaders) throw new Error('`headers` was called outside a request scope')
		return incomingHeaders
	},
}))

import { clientIpHeaders, currentClientIpHeaders, getClientIp } from '@/lib/server/client-ip'

// Built at runtime: no secret-looking literal in the repo.
const PROXY_SECRET = 'test-proxy-secret-'.padEnd(40, '0')

describe('getClientIp', () => {
	it.each([
		[{ 'x-real-ip': '198.51.100.9', 'x-forwarded-for': '203.0.113.7' }, '198.51.100.9'],
		[{ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }, '203.0.113.7'],
		[{ 'x-forwarded-for': ' 2001:db8::7 ' }, '2001:db8::7'],
		[{ 'x-real-ip': 'garbage', 'x-forwarded-for': '203.0.113.7' }, '203.0.113.7'],
		[{ 'x-real-ip': '198.51.100.9:443' }, null],
		[{ 'x-forwarded-for': 'unknown, 203.0.113.7' }, null],
		[{}, null],
	])('%o -> %s', (headers, expected) => {
		expect(getClientIp(new Headers(headers))).toBe(expected)
	})
})

describe('clientIpHeaders', () => {
	afterEach(() => {
		delete process.env.PROXY_SHARED_SECRET
		incomingHeaders = null
	})

	it('adds nothing when PROXY_SHARED_SECRET is unset', () => {
		expect(clientIpHeaders(new Headers({ 'x-real-ip': '198.51.100.9' }))).toEqual({})
	})

	it('adds the client IP and the secret when PROXY_SHARED_SECRET is set', () => {
		process.env.PROXY_SHARED_SECRET = PROXY_SECRET
		expect(clientIpHeaders(new Headers({ 'x-real-ip': '198.51.100.9' }))).toEqual({
			'X-Client-IP': '198.51.100.9',
			'X-Proxy-Secret': PROXY_SECRET,
		})
	})

	it('never fabricates an IP: nothing is added when it is unknown', () => {
		process.env.PROXY_SHARED_SECRET = PROXY_SECRET
		expect(clientIpHeaders(new Headers())).toEqual({})
		expect(clientIpHeaders(undefined)).toEqual({})
	})

	it('reads the current request through next/headers, and adds nothing outside one', async () => {
		process.env.PROXY_SHARED_SECRET = PROXY_SECRET
		await expect(currentClientIpHeaders()).resolves.toEqual({})

		incomingHeaders = new Headers({ 'x-forwarded-for': '203.0.113.7' })
		await expect(currentClientIpHeaders()).resolves.toEqual({
			'X-Client-IP': '203.0.113.7',
			'X-Proxy-Secret': PROXY_SECRET,
		})
	})
})
