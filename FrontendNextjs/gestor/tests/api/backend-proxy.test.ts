// @vitest-environment node
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const BACKEND_TOKEN = 'backend-access-token-secret'
let currentSession: Record<string, unknown> | null = null

const authWrapperCalls = vi.fn()
let authSetsCookie = false

// auth(handler) wraps the route: emulate next-auth attaching the session to
// req.auth and writing a (refreshed) session cookie on the response.
vi.mock('@/auth', () => ({
	auth: (handler: (req: any, ctx: any) => Promise<Response>) => async (req: any, ctx: any) => {
		authWrapperCalls()
		const res = await handler(Object.assign(req, { auth: currentSession }), ctx)
		if (authSetsCookie) res.headers.append('set-cookie', 'authjs.session-token=rotated; Path=/; HttpOnly')
		return res
	},
}))

const readSessionJwtMock = vi.fn()
vi.mock('@/lib/auth/session-cookie', () => ({
	readSessionJwt: (...args: unknown[]) => readSessionJwtMock(...args),
}))

const getBackendAccessTokenMock = vi.fn()
vi.mock('@/lib/auth/backend-token', () => ({
	getBackendAccessToken: (...args: unknown[]) => getBackendAccessTokenMock(...args),
}))

import { GET as getRoute, POST as postRoute } from '@/app/api/backend/[...path]/route'

function ctx(path: string[]) {
	return { params: Promise.resolve({ path }) }
}

// Route handlers are typed as `void | Response`; the proxy always returns a Response.
const GET = async (req: NextRequest, context: ReturnType<typeof ctx>) => (await getRoute(req, context)) as Response
const POST = async (req: NextRequest, context: ReturnType<typeof ctx>) => (await postRoute(req, context)) as Response

function browserRequest(url: string, init: { method?: string; body?: string; headers?: Record<string, string> } = {}) {
	return new NextRequest(url, {
		...init,
		headers: {
			cookie: 'authjs.session-token=encrypted-session',
			authorization: 'Bearer attacker-supplied',
			'content-type': 'application/json',
			'x-forwarded-for': '203.0.113.7',
			...init.headers,
		},
	})
}

async function readAll(response: Response) {
	return new TextDecoder().decode(await response.arrayBuffer())
}

describe('backend proxy route', () => {
	const fetchMock = vi.fn()

	beforeEach(() => {
		process.env.BACKEND_URL = 'http://backend.test'
		currentSession = { user: { id: 'u1', role: 'USER' }, expires: '2099-01-01' }
		getBackendAccessTokenMock.mockReset().mockResolvedValue(BACKEND_TOKEN)
		authWrapperCalls.mockReset()
		readSessionJwtMock.mockReset()
		fetchMock.mockReset()
		vi.stubGlobal('fetch', fetchMock)
	})

	afterEach(() => {
		vi.unstubAllGlobals()
	})

	it('forwards method, path and query with the session token attached server-side', async () => {
		fetchMock.mockResolvedValue(
			new Response(JSON.stringify([{ id: 'a1' }]), {
				status: 200,
				headers: { 'content-type': 'application/json', 'set-cookie': 'backend=1', 'x-request-id': 'req-1' },
			}),
		)

		const res = await GET(browserRequest('http://localhost:3000/api/backend/account?limit=5'), ctx(['account']))

		expect(fetchMock).toHaveBeenCalledTimes(1)
		const [target, init] = fetchMock.mock.calls[0]
		expect(String(target)).toBe('http://backend.test/account?limit=5')
		expect(init.method).toBe('GET')
		const headers = init.headers as Headers
		expect(headers.get('authorization')).toBe(`Bearer ${BACKEND_TOKEN}`)
		expect(headers.get('cookie')).toBeNull()
		expect(headers.get('x-forwarded-for')).toBe('203.0.113.7')

		expect(res.status).toBe(200)
		expect(res.headers.get('x-request-id')).toBe('req-1')
		expect(res.headers.get('set-cookie')).toBeNull()
		expect(await res.json()).toEqual([{ id: 'a1' }])
	})

	it('sends the UI locale (locale cookie) as Accept-Language instead of the browser preference', async () => {
		fetchMock.mockResolvedValue(new Response(null, { status: 204 }))
		const cases: [string, string][] = [
			['authjs.session-token=encrypted-session; locale=en', 'en'],
			['authjs.session-token=encrypted-session; locale=es', 'es'],
			// missing or unsupported values fall back to the default locale
			['authjs.session-token=encrypted-session', 'es'],
			['authjs.session-token=encrypted-session; locale=fr', 'es'],
		]

		for (const [cookie, expected] of cases) {
			fetchMock.mockClear()
			await GET(
				browserRequest('http://localhost:3000/api/backend/account', {
					headers: { cookie, 'accept-language': 'fr-FR,fr;q=0.9,de;q=0.8' },
				}),
				ctx(['account']),
			)
			const headers = fetchMock.mock.calls[0][1].headers as Headers
			expect(headers.get('accept-language')).toBe(expected)
		}
	})

	it('never leaks the backend token back to the browser', async () => {
		fetchMock.mockResolvedValue(new Response('{"ok":true}', { headers: { 'content-type': 'application/json' } }))

		const res = await GET(browserRequest('http://localhost:3000/api/backend/profile'), ctx(['profile']))

		const headerDump = JSON.stringify(Array.from(res.headers.entries()))
		expect(headerDump).not.toContain(BACKEND_TOKEN)
		expect(await readAll(res)).not.toContain(BACKEND_TOKEN)
	})

	it('forwards the request body for writes', async () => {
		fetchMock.mockResolvedValue(new Response(null, { status: 201 }))
		const body = JSON.stringify({ name: 'Savings' })

		const res = await POST(
			browserRequest('http://localhost:3000/api/backend/account', { method: 'POST', body }),
			ctx(['account']),
		)

		const [, init] = fetchMock.mock.calls[0]
		expect(init.method).toBe('POST')
		expect(new TextDecoder().decode(init.body)).toBe(body)
		expect(res.status).toBe(201)
	})

	it('forwards public calls without credentials when there is no session', async () => {
		currentSession = null
		fetchMock.mockResolvedValue(new Response('"demo-token"', { headers: { 'content-type': 'application/json' } }))

		await POST(browserRequest('http://localhost:3000/api/backend/auth/demo', { method: 'POST' }), ctx(['auth', 'demo']))

		const headers = fetchMock.mock.calls[0][1].headers as Headers
		expect(headers.get('authorization')).toBeNull()
		expect(getBackendAccessTokenMock).not.toHaveBeenCalled()
	})

	it('returns 401 without calling the backend when the session refresh failed', async () => {
		currentSession = { user: { id: 'u1' }, error: 'RefreshTokenError' }

		const res = await GET(browserRequest('http://localhost:3000/api/backend/account'), ctx(['account']))

		expect(res.status).toBe(401)
		expect(fetchMock).not.toHaveBeenCalled()
	})

	it('rejects path traversal segments', async () => {
		const res = await GET(browserRequest('http://localhost:3000/api/backend/x'), ctx(['..', 'admin']))

		expect(res.status).toBe(400)
		expect(fetchMock).not.toHaveBeenCalled()
	})
})

describe('backend proxy route: Server-Sent Events', () => {
	let server: http.Server
	let upstreamRequests: { url?: string; headers: http.IncomingHttpHeaders }[]
	let upstreamClosed: Promise<void>
	let onUpstreamRequest: (res: http.ServerResponse) => void

	beforeEach(async () => {
		upstreamRequests = []
		authSetsCookie = true
		authWrapperCalls.mockReset()
		getBackendAccessTokenMock.mockReset()
		readSessionJwtMock.mockReset().mockResolvedValue({
			accessToken: BACKEND_TOKEN,
			refreshToken: 'refresh-current',
			accessTokenExpires: Date.now() + 10 * 60 * 1000,
		})
		let markClosed: () => void = () => {}
		upstreamClosed = new Promise((resolve) => {
			markClosed = resolve
		})
		onUpstreamRequest = (res) => {
			res.writeHead(200, {
				'content-type': 'text/event-stream',
				'set-cookie': 'backend=1',
			})
			res.write(': connected\n\n')
			res.write('event: message\ndata: {"type":"info","message":"hi"}\n\n')
		}
		server = http.createServer((req, res) => {
			upstreamRequests.push({ url: req.url, headers: req.headers })
			req.on('close', () => markClosed())
			onUpstreamRequest(res)
		})
		await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
		process.env.BACKEND_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
	})

	afterEach(async () => {
		authSetsCookie = false
		server.closeAllConnections()
		await new Promise<void>((resolve) => server.close(() => resolve()))
	})

	function sseRequest(controller?: AbortController) {
		return new NextRequest('http://localhost:3000/api/backend/notifications', {
			headers: { cookie: 'authjs.session-token=encrypted-session', accept: 'text/event-stream' },
			signal: controller?.signal,
		})
	}

	async function readUntil(reader: ReadableStreamDefaultReader<Uint8Array>, needle: string) {
		const decoder = new TextDecoder()
		let text = ''
		while (!text.includes(needle)) {
			const { value, done } = await reader.read()
			if (done) break
			text += decoder.decode(value, { stream: true })
		}
		return text
	}

	it('streams events with the session token and never writes a session cookie', async () => {
		const res = await GET(sseRequest(), ctx(['notifications']))

		expect(res.status).toBe(200)
		expect(res.headers.get('content-type')).toBe('text/event-stream')
		expect(res.headers.get('cache-control')).toContain('no-transform')
		expect(res.headers.get('set-cookie')).toBeNull()
		// The cookie-rewriting auth() wrapper and the refreshing token path are bypassed.
		expect(authWrapperCalls).not.toHaveBeenCalled()
		expect(getBackendAccessTokenMock).not.toHaveBeenCalled()
		expect(upstreamRequests[0].url).toBe('/notifications')
		expect(upstreamRequests[0].headers.authorization).toBe(`Bearer ${BACKEND_TOKEN}`)
		expect(upstreamRequests[0].headers.cookie).toBeUndefined()
		expect(upstreamRequests[0].headers['accept-language']).toBe('es')

		const reader = (res.body as ReadableStream<Uint8Array>).getReader()
		const text = await readUntil(reader, '"message":"hi"')
		expect(text).toContain(': connected')
		expect(text).toContain('"message":"hi"')
		await reader.cancel()
	})

	it('propagates a client abort to the upstream request', async () => {
		const controller = new AbortController()
		const res = await GET(sseRequest(controller), ctx(['notifications']))
		const reader = (res.body as ReadableStream<Uint8Array>).getReader()
		await readUntil(reader, ': connected')

		controller.abort()

		await expect(upstreamClosed).resolves.toBeUndefined()
		// The proxied body ends (cleanly) once the upstream request is gone.
		let result = await reader.read()
		while (!result.done) result = await reader.read()
		expect(result.done).toBe(true)
	})

	it('closes the upstream request when the response body is cancelled', async () => {
		const res = await GET(sseRequest(), ctx(['notifications']))
		await (res.body as ReadableStream<Uint8Array>).cancel()

		await expect(upstreamClosed).resolves.toBeUndefined()
	})

	it('answers 401 without refreshing when the access token is expired', async () => {
		readSessionJwtMock.mockResolvedValue({
			accessToken: BACKEND_TOKEN,
			refreshToken: 'refresh-current',
			accessTokenExpires: Date.now() - 1000,
		})

		const res = await GET(sseRequest(), ctx(['notifications']))

		expect(res.status).toBe(401)
		expect(res.headers.get('set-cookie')).toBeNull()
		expect(upstreamRequests).toHaveLength(0)
		expect(getBackendAccessTokenMock).not.toHaveBeenCalled()
	})

	it('answers 401 when there is no session or its refresh failed', async () => {
		readSessionJwtMock.mockResolvedValueOnce(null)
		expect((await GET(sseRequest(), ctx(['notifications']))).status).toBe(401)

		readSessionJwtMock.mockResolvedValueOnce({ accessToken: BACKEND_TOKEN, error: 'RefreshTokenError' })
		expect((await GET(sseRequest(), ctx(['notifications']))).status).toBe(401)
		expect(upstreamRequests).toHaveLength(0)
	})

	it('keeps regular requests on the auth() path', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue(new Response('[]', { headers: { 'content-type': 'application/json' } })),
		)
		getBackendAccessTokenMock.mockResolvedValue(BACKEND_TOKEN)
		currentSession = { user: { id: 'u1' }, expires: '2099-01-01' }

		const res = await GET(
			new NextRequest('http://localhost:3000/api/backend/notifications/history', {
				headers: { cookie: 'authjs.session-token=encrypted-session' },
			}),
			ctx(['notifications', 'history']),
		)

		expect(authWrapperCalls).toHaveBeenCalledTimes(1)
		expect(res.headers.get('set-cookie')).toContain('authjs.session-token=rotated')
		vi.unstubAllGlobals()
	})
})
