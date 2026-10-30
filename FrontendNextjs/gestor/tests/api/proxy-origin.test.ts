// @vitest-environment node
import { NextRequest } from 'next/server'
import { describe, expect, it } from 'vitest'
import { rejectCrossOriginWrite } from '@/lib/server/backend-proxy'

const URL_ = 'http://localhost:3000/api/backend/account'

function request(method: string, headers: Record<string, string> = {}, url = URL_) {
	return new NextRequest(url, { method, headers })
}

function status(req: NextRequest) {
	return rejectCrossOriginWrite(req)?.status ?? 'allowed'
}

describe('rejectCrossOriginWrite (proxy CSRF guard)', () => {
	it.each(['GET', 'HEAD', 'OPTIONS'])('never blocks %s, whatever its origin', (method) => {
		expect(status(request(method, { origin: 'https://evil.com', 'sec-fetch-site': 'cross-site' }))).toBe('allowed')
	})

	it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('allows a same-origin %s from the browser', (method) => {
		expect(status(request(method, { origin: 'http://localhost:3000', 'sec-fetch-site': 'same-origin' }))).toBe(
			'allowed',
		)
	})

	it('allows writes that carry neither Origin nor Sec-Fetch-Site (server-to-server, old browsers)', () => {
		expect(status(request('POST'))).toBe('allowed')
	})

	it('allows Sec-Fetch-Site: none (user-initiated navigation)', () => {
		expect(status(request('POST', { 'sec-fetch-site': 'none' }))).toBe('allowed')
	})

	it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('blocks a %s whose Origin is another site', async (method) => {
		const res = rejectCrossOriginWrite(request(method, { origin: 'https://evil.com' }))
		expect(res?.status).toBe(403)
		expect(await res?.json()).toEqual({ error: 'Cross-origin request rejected' })
	})

	it.each([
		['another port', 'http://localhost:4000'],
		['a subdomain', 'http://api.localhost:3000'],
		['an opaque origin', 'null'],
		['garbage', 'not a url'],
	])('blocks an Origin on %s', (_label, origin) => {
		expect(status(request('POST', { origin }))).toBe(403)
	})

	it.each(['cross-site', 'same-site'])('blocks Sec-Fetch-Site: %s even without Origin', (site) => {
		expect(status(request('POST', { 'sec-fetch-site': site }))).toBe(403)
	})

	it('blocks when Sec-Fetch-Site says cross-site even if Origin matches', () => {
		expect(status(request('POST', { origin: 'http://localhost:3000', 'sec-fetch-site': 'cross-site' }))).toBe(403)
	})

	it('accepts the public host behind a reverse proxy (Host / X-Forwarded-Host), ignoring the scheme', () => {
		const internal = 'http://10.0.0.5:3000/api/backend/account'
		expect(status(request('POST', { origin: 'https://app.example.com', host: 'app.example.com' }, internal))).toBe(
			'allowed',
		)
		expect(
			status(request('POST', { origin: 'https://app.example.com', 'x-forwarded-host': 'app.example.com' }, internal)),
		).toBe('allowed')
		expect(status(request('POST', { origin: 'https://evil.com', host: 'app.example.com' }, internal))).toBe(403)
	})
})
