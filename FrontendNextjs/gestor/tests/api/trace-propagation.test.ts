// @vitest-environment node
import { AsyncLocalStorage } from 'node:async_hooks'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import {
	type Context,
	type ContextManager,
	context,
	propagation,
	ROOT_CONTEXT,
	type TextMapPropagator,
	trace,
} from '@opentelemetry/api'
import { NextRequest } from 'next/server'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/auth', () => ({
	auth: (handler: (req: any, ctx: any) => Promise<Response>) => async (req: any, ctx: any) =>
		handler(Object.assign(req, { auth: { user: { id: 'u1' }, expires: '2099-01-01' } }), ctx),
}))
vi.mock('@/lib/auth/session-cookie', () => ({
	readSessionJwt: async () => ({ accessToken: 'tok', accessTokenExpires: Date.now() + 600_000 }),
}))
vi.mock('@/lib/auth/backend-token', () => ({ getBackendAccessToken: async () => 'tok' }))
vi.mock('next/headers', () => ({
	headers: async () => new Headers(),
	cookies: async () => ({ get: () => undefined }),
}))

import { GET } from '@/app/api/backend/[...path]/route'
import { serverAccountRepository } from '@/lib/server/repositories'

const TRACE_ID = '4bf92f3577b34da6a3ce929d0e0e4736'
const SPAN_ID = '00f067aa0ba902b7'
const EXPECTED_TRACEPARENT = `00-${TRACE_ID}-${SPAN_ID}-01`

/** Minimal AsyncLocalStorage context manager (what @vercel/otel installs in Node). */
class AlsContextManager implements ContextManager {
	private als = new AsyncLocalStorage<Context>()
	active() {
		return this.als.getStore() ?? ROOT_CONTEXT
	}
	with<A extends unknown[], F extends (...args: A) => ReturnType<F>>(
		ctx: Context,
		fn: F,
		thisArg?: ThisParameterType<F>,
		...args: A
	): ReturnType<F> {
		return this.als.run(ctx, () => fn.call(thisArg, ...args))
	}
	bind<T>(_ctx: Context, target: T): T {
		return target
	}
	enable() {
		return this
	}
	disable() {
		this.als.disable()
		return this
	}
}

/** W3C traceparent writer (stands in for @vercel/otel's propagator). */
const traceparentPropagator: TextMapPropagator = {
	inject(ctx, carrier, setter) {
		const sc = trace.getSpanContext(ctx)
		if (sc) setter.set(carrier, 'traceparent', `00-${sc.traceId}-${sc.spanId}-0${sc.traceFlags}`)
	},
	extract: (ctx) => ctx,
	fields: () => ['traceparent'],
}

function withActiveSpan<T>(fn: () => Promise<T>): Promise<T> {
	const ctx = trace.setSpanContext(ROOT_CONTEXT, { traceId: TRACE_ID, spanId: SPAN_ID, traceFlags: 1 })
	return context.with(ctx, fn)
}

const routeCtx = (path: string[]) => ({ params: Promise.resolve({ path }) })

describe('W3C trace context propagation to the backend', () => {
	const fetchMock = vi.fn()

	beforeAll(() => {
		context.setGlobalContextManager(new AlsContextManager())
		propagation.setGlobalPropagator(traceparentPropagator)
	})
	afterAll(() => {
		context.disable()
		propagation.disable()
	})
	beforeEach(() => {
		process.env.BACKEND_URL = 'http://backend.test'
		fetchMock.mockReset().mockImplementation(async () => Response.json([]))
		vi.stubGlobal('fetch', fetchMock)
	})
	afterEach(() => vi.unstubAllGlobals())

	it('proxy fetch carries the active span as traceparent and reports Server-Timing', async () => {
		const res = (await withActiveSpan(() =>
			GET(new NextRequest('http://localhost:3000/api/backend/account'), routeCtx(['account'])),
		)) as Response

		const headers = fetchMock.mock.calls[0][1].headers as Headers
		expect(headers.get('traceparent')).toBe(EXPECTED_TRACEPARENT)
		expect(res.headers.get('server-timing')).toMatch(/^backend;desc="Go API";dur=\d+(\.\d)?$/)
	})

	it('server component repositories send traceparent', async () => {
		await withActiveSpan(() => serverAccountRepository.findAll())
		const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>
		expect(headers.traceparent).toBe(EXPECTED_TRACEPARENT)
	})

	it('the raw node:http SSE path injects traceparent manually', async () => {
		let received: http.IncomingHttpHeaders = {}
		const server = http.createServer((req, res) => {
			received = req.headers
			res.writeHead(204)
			res.end()
		})
		await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
		process.env.BACKEND_URL = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
		try {
			const res = (await withActiveSpan(() =>
				GET(
					new NextRequest('http://localhost:3000/api/backend/notifications', {
						headers: { accept: 'text/event-stream' },
					}),
					routeCtx(['notifications']),
				),
			)) as Response
			expect(res.status).toBe(204)
			expect(received.traceparent).toBe(EXPECTED_TRACEPARENT)
			expect(res.headers.get('server-timing')).toContain('backend;')
		} finally {
			server.closeAllConnections()
			await new Promise<void>((resolve) => server.close(() => resolve()))
		}
	})
})

describe('without OpenTelemetry registered', () => {
	const fetchMock = vi.fn()
	beforeEach(() => {
		process.env.BACKEND_URL = 'http://backend.test'
		fetchMock.mockReset().mockImplementation(async () => Response.json([]))
		vi.stubGlobal('fetch', fetchMock)
	})
	afterEach(() => vi.unstubAllGlobals())

	it('adds no trace headers but passes an upstream traceparent through', async () => {
		await GET(new NextRequest('http://localhost:3000/api/backend/account'), routeCtx(['account']))
		expect((fetchMock.mock.calls[0][1].headers as Headers).get('traceparent')).toBeNull()

		await GET(
			new NextRequest('http://localhost:3000/api/backend/account', {
				headers: { traceparent: EXPECTED_TRACEPARENT },
			}),
			routeCtx(['account']),
		)
		expect((fetchMock.mock.calls[1][1].headers as Headers).get('traceparent')).toBe(EXPECTED_TRACEPARENT)
	})
})
