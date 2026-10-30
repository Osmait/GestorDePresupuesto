import 'server-only'
import http from 'node:http'
import https from 'node:https'
import type { NextRequest } from 'next/server'
import { getBackendAccessToken } from '@/lib/auth/backend-token'
import { readSessionJwt } from '@/lib/auth/session-cookie'
import { SESSION_REFRESHED_HEADER } from '@/lib/auth/session-sync'
import { getBackendUrl } from '@/lib/backend-url'
import { LOCALE_COOKIE, resolveLocale } from '@/lib/i18n/locales'
import { clientIpHeaders } from '@/lib/server/client-ip'
import { injectTraceContext, upstreamServerTiming } from '@/lib/server/trace-context'

/**
 * Request headers forwarded to the backend. Cookies and client Authorization
 * are never forwarded; Accept-Language is replaced by the UI locale.
 * `traceparent`/`tracestate` from an upstream edge are passed through, and
 * overwritten with this server's span when OpenTelemetry is enabled.
 * `accept-encoding` is added for regular (non-streaming) requests only.
 *
 * The browser's `x-forwarded-for` / `x-real-ip` are not forwarded: the
 * backend's edge overwrites X-Real-IP with this server's IP and never trusts a
 * caller's X-Forwarded-For, so they had no effect. The client IP travels in
 * `X-Client-IP`, authenticated by PROXY_SHARED_SECRET (see `clientIpHeaders`).
 */
const FORWARDED_REQUEST_HEADERS = [
	'accept',
	'cache-control',
	'content-type',
	'last-event-id',
	'user-agent',
	'x-request-id',
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

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])
const SAME_ORIGIN_FETCH_SITES = new Set(['same-origin', 'none'])

/**
 * Hosts this request may legitimately come from: the request URL's own host,
 * plus the `Host` / `X-Forwarded-Host` the server was reached with (behind a
 * reverse proxy the URL can carry the internal host). A cross-site page cannot
 * forge these on a browser request: setting X-Forwarded-Host needs a CORS
 * preflight, which this route never grants.
 */
function ownHosts(req: NextRequest): Set<string> {
	const hosts = new Set([req.nextUrl.host.toLowerCase()])
	const host = req.headers.get('host')
	if (host) hosts.add(host.trim().toLowerCase())
	const forwardedHost = req.headers.get('x-forwarded-host')?.split(',')[0]?.trim()
	if (forwardedHost) hosts.add(forwardedHost.toLowerCase())
	return hosts
}

/** Host of an `Origin` header value; null for `null` and anything unparsable. */
function originHost(origin: string): string | null {
	try {
		return new URL(origin).host.toLowerCase()
	} catch {
		return null
	}
}

/**
 * CSRF guard: the proxy authenticates with the session cookie alone, so a
 * state-changing request triggered by another site must not get through.
 * Writes are rejected when the browser says they are cross-origin (`Origin`
 * names another host, or `Sec-Fetch-Site` is not same-origin/none). Requests
 * without either header (server-to-server calls, old browsers) pass.
 *
 * The scheme is not compared: behind a TLS-terminating proxy the request URL
 * may say http while the browser's Origin says https.
 *
 * Returns the 403 response to send, or null when the request may proceed.
 */
export function rejectCrossOriginWrite(req: NextRequest): Response | null {
	if (SAFE_METHODS.has(req.method.toUpperCase())) return null

	const fetchSite = req.headers.get('sec-fetch-site')?.trim().toLowerCase()
	if (fetchSite && !SAME_ORIGIN_FETCH_SITES.has(fetchSite)) return jsonError(403, 'Cross-origin request rejected')

	const origin = req.headers.get('origin')
	if (origin !== null) {
		const host = originHost(origin.trim())
		if (!host || !ownHosts(req).has(host)) return jsonError(403, 'Cross-origin request rejected')
	}
	return null
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
	// The browser's IP for the backend's per-IP rate limits (only with PROXY_SHARED_SECRET).
	for (const [name, value] of Object.entries(clientIpHeaders(req.headers))) headers.set(name, value)
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

interface StreamCredentials {
	accessToken: string
	/** True when the token was refreshed for this request (the cookie still holds the old one). */
	refreshed: boolean
}

/**
 * Access token for a streaming request, read from the session cookie.
 *
 * A token that is still valid is used as is, even inside the refresh window:
 * a stream's response cannot persist a rotated session cookie (no Set-Cookie,
 * see `proxyStreamToBackend`), so it never rotates tokens it does not need to.
 *
 * An expired (or about to expire) token is refreshed through the same deduped
 * `ensureFreshToken` as every other call, e.g. on a full reload after the token
 * expired, where the Server Component render already rotated it: the stream
 * then reuses that rotation from the shared grace store instead of answering
 * 401. The caller tells the client to re-sync its session so the rotated
 * cookie gets persisted.
 */
async function getStreamCredentials(headers: Headers): Promise<StreamCredentials | null> {
	const token = await readSessionJwt(headers)
	if (!token || token.error) return null
	const expiresAt = typeof token.accessTokenExpires === 'number' ? token.accessTokenExpires : 0
	if (
		typeof token.accessToken === 'string' &&
		token.accessToken &&
		Date.now() < expiresAt - STREAM_TOKEN_MIN_VALIDITY_MS
	) {
		return { accessToken: token.accessToken, refreshed: false }
	}

	const accessToken = await getBackendAccessToken(headers, token)
	if (!accessToken) return null
	return { accessToken, refreshed: accessToken !== token.accessToken }
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
 * a Set-Cookie header (headers of a stream may only reach the browser minutes
 * later, after the cookie was rotated again by other requests, and the stale
 * refresh token would then be replayed). An expired token is still refreshed
 * (deduped, see `getStreamCredentials`); the response then carries
 * `SESSION_REFRESHED_HEADER` so the client persists the rotated session.
 */
export async function proxyStreamToBackend(req: NextRequest, path: string[]): Promise<Response> {
	const target = buildTargetUrl(path, req.nextUrl.search)
	if (!target) return jsonError(400, 'Invalid backend path')

	const credentials = await getStreamCredentials(req.headers)
	if (!credentials) return jsonError(401, 'Unauthorized')

	const headers = forwardedRequestHeaders(req, { acceptEncoding: false })
	headers.set('authorization', `Bearer ${credentials.accessToken}`)

	let upstream: Response
	try {
		upstream = await openUpstream(target, { method: 'GET', headers, signal: req.signal, streaming: true })
	} catch (error) {
		if (req.signal?.aborted) return new Response(null, { status: 499 })
		return backendUnavailable(error)
	}

	// proxiedResponseHeaders already dropped any upstream Set-Cookie.
	if (credentials.refreshed) upstream.headers.set(SESSION_REFRESHED_HEADER, '1')
	return upstream
}
