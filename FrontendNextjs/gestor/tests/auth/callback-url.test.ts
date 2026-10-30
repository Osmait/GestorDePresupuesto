import { describe, expect, it } from 'vitest'
import { getSafeCallbackUrl } from '@/lib/auth/callback-url'

describe('getSafeCallbackUrl', () => {
	it.each([
		['/app', '/app'],
		['/app/accounts?x=1#h', '/app/accounts?x=1#h'],
		['/app/transactions?page=2&sortBy=amount', '/app/transactions?page=2&sortBy=amount'],
		// Encoded slashes / backslashes stay inside the path: the browser does not decode them into a host.
		['/%2F%2Fevil.com', '/%2F%2Fevil.com'],
		['/%5Cevil.com', '/%5Cevil.com'],
	])('keeps the same-origin path %j', (value, expected) => {
		expect(getSafeCallbackUrl(value)).toBe(expected)
	})

	it.each([
		null,
		undefined,
		'',
		'app',
		'//evil.com',
		'/\\evil.com',
		'https://evil.com',
		'javascript:alert(1)',
		'%2F%2Fevil.com',
		// The URL parser strips tab/newline: these resolve to https://evil.com.
		'/\t/evil.com',
		'/\n/evil.com',
		'/\r/evil.com',
		'/\t\\evil.com',
		'/\x00/evil.com',
		'/\x7f/evil.com',
		'/app\\..\\..\\evil.com',
		// Dot segments that collapse into a protocol-relative path.
		'/.//evil.com',
		'/a/..//evil.com',
	])('falls back to /app for the unsafe value %j', (value) => {
		expect(getSafeCallbackUrl(value)).toBe('/app')
	})

	it.each(['/login', '/login?callbackUrl=%2Fapp', '/register', '/./login', '/%2e/register'])(
		'never sends the user back to the auth page %j',
		(value) => {
			expect(getSafeCallbackUrl(value)).toBe('/app')
		},
	)
})
