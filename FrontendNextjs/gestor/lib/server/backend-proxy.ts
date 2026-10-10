import 'server-only'
import http from 'node:http'
import https from 'node:https'
import type { NextRequest } from 'next/server'
import { readSessionJwt } from '@/lib/auth/session-cookie'
import { getBackendUrl } from '@/lib/backend-url'
import { LOCALE_COOKIE, resolveLocale } from '@/lib/i18n/locales'
import { injectTraceContext, upstreamServerTiming } from '@/lib/server/trace-context'

/**
 * Request headers forwarded to the backend. Cookies and client Authorization
 * are never forwarded; Accept-Language is replaced by the UI locale.
 * `traceparent`/`tracestate` from an upstream edge are passed through, and
 * overwritten with this server's span when OpenTelemetry is enabled.
 * `accept-encoding` is added for regular (non-streaming) requests only.
 */
const FORWARDED_REQUEST_HEADERS = [
	'accept',
	'cache-control',
	'content-type',
	'last-event-id',
	'user-agent',
	'x-request-id',
	'x-forwarded-for',
	'x-real-ip',
	'traceparent',
	'tracestate',
]

/**
 * Hop-by-hop headers that must not be copied from the upstream response.
 * `content-encoding` is kept: the upstream body is passed through byte for byte
 * (still compressed). `content-length` is dropped and the body is streamed.
 */
const STRIPPED_RESPONSE_HEADERS = new Set([
	'connection',
	'keep-alive',
	'transfer-encoding',
	'content-length',
	'proxy-authenticate',
	'trailer',
	'upgrade',
	'set-cookie',
])

function jsonError(status: number, message: string) {
	return Response.json({ error: message }, { status, headers: { 'cache-control': 'no-store' } })
}

/**
 * 502 for a backend that could not be reached. The cause is logged server-side
 * only: node:http errors name the internal backend address (e.g. ECONNREFUSED host:port).
 */
function backendUnavailable(error: unknown) {
	console.error('[backend-proxy] backend unavailable:', error instanceof Error ? error.message : error)
	return jsonError(502, 'Backend unavailable')
}

function buildTargetUrl(path: string[], search: string): URL | null {
	if (path.length === 0 || path.some((segment) => !segment || segment === '.' || segment === '..')) return null
	const url = new URL(`${getBackendUrl()}/${path.map(encodeURIComponent).join('/')}`)
	url.search = search
	return url
}

function forwardedRequestHeaders(req: NextRequest, { acceptEncoding }: { acceptEncoding: boolean }): Headers {
	const headers = new Headers()
	for (const name of FORWARDED_REQUEST_HEADERS) {
		const value = req.headers.get(name)
		if (value) headers.set(name, value)
	}
	// Compressed upstream bodies are streamed to the browser untouched, so the
	// browser's own Accept-Encoding is what the backend must honour. Streams
	// (SSE) always ask for identity: a compressing upstream would buffer events.
	const encoding = acceptEncoding ? req.headers.get('accept-encoding') : null
	headers.set('accept-encoding', encoding || 'identity')
	// The backend localizes the names it generates (e.g. "Card payment") in the
	// language the user picked in the UI, not the browser's preference list.
	headers.set('accept-language', resolveLocale(req.cookies.get(LOCALE_COOKIE)?.value))
	// Continue the trace in the backend (no-op when OpenTelemetry is off).
	return injectTraceContext(headers)
}

function proxiedResponseHeaders(entries: [string, string][], serverTiming?: string): Headers {
	const responseHeaders = new Headers()
	for (const [name, value] of entries) {
		if (!STRIPPED_RESPONSE_HEADERS.has(name.toLowerCase())) responseHeaders.set(name, value)
	}
	if (serverTiming) responseHeaders.append('server-timing', serverTiming)
	if (responseHeaders.get('content-type')?.includes('text/event-stream')) {
		responseHeaders.set('cache-control', 'no-cache, no-transform')
		responseHeaders.set('x-accel-buffering', 'no')
	}
	return responseHeaders
}

/**
 * Credentials for a proxied call, resolved by the route from the session:
 * `null` forwards the call anonymously (no session), `{ error }` answers 401
 * without calling the backend.
 */
export type ProxyCredentials = { accessToken: string } | { error: string } | null

/**
 * Forwards a browser request to the backend, attaching the session's access
 * token server-side. The token is never echoed back to the client.
 * Long-lived streams (SSE) go through `proxyStreamToBackend` instead.
 */
export async function proxyToBackend(
	req: NextRequest,
	path: string[],
	credentials: ProxyCredentials,
): Promise<Response> {
	const target = buildTargetUrl(path, req.nextUrl.search)
	if (!target) return jsonError(400, 'Invalid backend path')
	if (credentials && 'error' in credentials) return jsonError(401, credentials.error)

	const headers = forwardedRequestHeaders(req, { acceptEncoding: true })
	if (credentials) headers.set('authorization', `Bearer ${credentials.accessToken}`)

	const hasBody = req.method !== 'GET' && req.method !== 'HEAD'
	try {
		const body = hasBody ? new Uint8Array(await req.arrayBuffer()) : undefined
		return await openUpstream(target, { method: req.method, headers, body, signal: req.signal, streaming: false })
	} catch (error) {
		if (req.signal?.aborted) return new Response(null, { status: 499 })
		return backendUnavailable(error)
	}
}

/** True for requests that open a long-lived Server-Sent Events stream. */
export function isStreamingRequest(req: NextRequest, path: string[]): boolean {
	if (req.method !== 'GET') return false
	if (req.headers.get('accept')?.includes('text/event-stream')) return true
	return path.length === 1 && path[0] === 'notifications'
}

/** Margin under which an access token is considered too close to expiry to open a stream with. */
const STREAM_TOKEN_MIN_VALIDITY_MS = 5 * 1000

/**
 * Access token for a streaming request, read straight from the session cookie.
 * It never refreshes: a stream's response cannot safely carry a rotated
 * session cookie (headers may only reach the browser minutes later, after the
 * cookie was rotated again by other requests, and the stale refresh token
 * would then be replayed). When the token is expired the client gets a 401,
 * re-fetches its session (which refreshes and persists the cookie) and
 * reconnects.
 */
async function getStreamAccessToken(headers: Headers): Promise<string | null> {
	const token = await readSessionJwt(headers)
	if (!token || token.error || typeof token.accessToken !== 'string' || !token.accessToken) return null
	const expiresAt = typeof token.accessTokenExpires === 'number' ? token.accessTokenExpires : 0
	if (Date.now() >= expiresAt - STREAM_TOKEN_MIN_VALIDITY_MS) return null
	return token.accessToken
}

const NULL_BODY_STATUSES = new Set([101, 204, 205, 304])

/** Keep-alive connections to the backend, shared by every proxied request. */
const httpAgent = new http.Agent({ keepAlive: true })
const httpsAgent = new https.Agent({ keepAlive: true })

/**
 * Regular requests give up when the backend stays silent this long (the same
 * 300s undici's fetch uses for headers and body). Streams have no idle timeout.
 */
const UPSTREAM_IDLE_TIMEOUT_MS = 300 * 1000

interface UpstreamRequest {
	method: string
	headers: Headers
	body?: Uint8Array
	signal: AbortSignal
	/** Long-lived stream (SSE): no idle timeout. */
	streaming: boolean
}

/**
 * Calls the backend with node:http instead of fetch, for two reasons:
 * - fetch (undici) always decompresses the body, while the proxy passes the
 *   backend's compressed bytes through untouched (`content-encoding` is kept);
 * - undici aborts a body that stays idle for 300s (BodyTimeoutError), which
 *   would cut long-lived SSE connections.
 * Aborting `signal` (client disconnect) or cancelling the returned body
 * destroys the upstream request.
 */
function openUpstream(target: URL, { method, headers, body, signal, streaming }: UpstreamRequest): Promise<Response> {
	return new Promise((resolve, reject) => {
		const isHttps = target.protocol === 'https:'
		const client = isHttps ? https : http
		const startedAt = performance.now()
		const requestHeaders = Object.fromEntries(headers)
		if (body) requestHeaders['content-length'] = String(body.byteLength)
		const upstreamReq = client.request(
			target,
			// `headers` already carries the traceparent (forwardedRequestHeaders):
			// fetch auto-instrumentation does not cover node:http.
			{ method, headers: requestHeaders, signal, agent: isHttps ? httpsAgent : httpAgent },
			(res) => {
				const status = res.statusCode ?? 502
				const serverTiming = upstreamServerTiming(startedAt)
				const responseHeaders: [string, string][] = []
				for (const [name, value] of Object.entries(res.headers)) {
					if (value === undefined) continue
					responseHeaders.push([name, Array.isArray(value) ? value.join(', ') : value])
				}

				if (NULL_BODY_STATUSES.has(status) || method === 'HEAD') {
					res.resume()
					resolve(new Response(null, { status, headers: proxiedResponseHeaders(responseHeaders, serverTiming) }))
					return
				}

				let finished = false
				const responseBody = new ReadableStream<Uint8Array>({
					start(controller) {
						const finish = (error?: unknown) => {
							if (finished) return
							finished = true
							try {
								if (error) controller.error(error)
								else controller.close()
							} catch {
								// stream already cancelled
							}
						}
						res.on('data', (chunk: Buffer) => {
							if (finished) return
							controller.enqueue(new Uint8Array(chunk))
							// Backpressure: stop reading from the backend until the consumer pulls again.
							if ((controller.desiredSize ?? 1) <= 0) res.pause()
						})
						res.on('end', () => finish())
						// A client disconnect ends the stream cleanly; other upstream failures surface as errors.
						res.on('error', (error) => finish(signal.aborted ? undefined : error))
						// A regular body cut short is an error (as with fetch); a stream that closes just ends.
						res.on('close', () =>
							finish(streaming || res.complete || signal.aborted ? undefined : new Error('Upstream closed')),
						)
					},
					pull() {
						res.resume()
					},
					cancel() {
						finished = true
						upstreamReq.destroy()
					},
				})

				resolve(
					new Response(responseBody, {
						status,
						statusText: res.statusMessage,
						headers: proxiedResponseHeaders(responseHeaders, serverTiming),
					}),
				)
			},
		)
		if (!streaming) {
			upstreamReq.setTimeout(UPSTREAM_IDLE_TIMEOUT_MS, () => {
				upstreamReq.destroy(new Error('Upstream timeout'))
			})
		}
		upstreamReq.on('error', reject)
		upstreamReq.end(body)
	})
}

/**
 * Proxies a long-lived Server-Sent Events stream. Unlike `proxyToBackend`, it
 * must NOT run behind next-auth's `auth()` wrapper: the response never carries
 * a Set-Cookie header, and the token is never refreshed here.
 */
export async function proxyStreamToBackend(req: NextRequest, path: string[]): Promise<Response> {
	const target = buildTargetUrl(path, req.nextUrl.search)
	if (!target) return jsonError(400, 'Invalid backend path')

	const accessToken = await getStreamAccessToken(req.headers)
	if (!accessToken) return jsonError(401, 'Unauthorized')

	const headers = forwardedRequestHeaders(req, { acceptEncoding: false })
	headers.set('authorization', `Bearer ${accessToken}`)

	let upstream: Response
	try {
		upstream = await openUpstream(target, { method: 'GET', headers, signal: req.signal, streaming: true })
	} catch (error) {
		if (req.signal?.aborted) return new Response(null, { status: 499 })
		return backendUnavailable(error)
	}

	// proxiedResponseHeaders already dropped any upstream Set-Cookie.
	return upstream
}
