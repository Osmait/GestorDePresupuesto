import 'server-only'
import http from 'node:http'
import https from 'node:https'
import type { NextRequest } from 'next/server'
import type { Session } from 'next-auth'
import { getBackendAccessToken } from '@/lib/auth/backend-token'
import { readSessionJwt } from '@/lib/auth/session-cookie'
import { getBackendUrl } from '@/lib/backend-url'
import { LOCALE_COOKIE, resolveLocale } from '@/lib/i18n/locales'

/**
 * Request headers forwarded to the backend. Cookies and client Authorization
 * are never forwarded; Accept-Language is replaced by the UI locale.
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
]

/** Hop-by-hop / body-encoding headers that must not be copied from the upstream response. */
const STRIPPED_RESPONSE_HEADERS = new Set([
	'connection',
	'keep-alive',
	'transfer-encoding',
	'content-encoding',
	'content-length',
	'proxy-authenticate',
	'trailer',
	'upgrade',
	'set-cookie',
])

function jsonError(status: number, message: string) {
	return Response.json({ error: message }, { status, headers: { 'cache-control': 'no-store' } })
}

function buildTargetUrl(path: string[], search: string): URL | null {
	if (path.length === 0 || path.some((segment) => !segment || segment === '.' || segment === '..')) return null
	const url = new URL(`${getBackendUrl()}/${path.map(encodeURIComponent).join('/')}`)
	url.search = search
	return url
}

function forwardedRequestHeaders(req: NextRequest): Headers {
	const headers = new Headers()
	for (const name of FORWARDED_REQUEST_HEADERS) {
		const value = req.headers.get(name)
		if (value) headers.set(name, value)
	}
	// The backend localizes the names it generates (e.g. "Card payment") in the
	// language the user picked in the UI, not the browser's preference list.
	headers.set('accept-language', resolveLocale(req.cookies.get(LOCALE_COOKIE)?.value))
	return headers
}

function proxiedResponseHeaders(entries: [string, string][]): Headers {
	const responseHeaders = new Headers()
	for (const [name, value] of entries) {
		if (!STRIPPED_RESPONSE_HEADERS.has(name.toLowerCase())) responseHeaders.set(name, value)
	}
	if (responseHeaders.get('content-type')?.includes('text/event-stream')) {
		responseHeaders.set('cache-control', 'no-cache, no-transform')
		responseHeaders.set('x-accel-buffering', 'no')
	}
	return responseHeaders
}

/**
 * Forwards a browser request to the backend, attaching the session's access
 * token server-side. The token is never echoed back to the client.
 * Long-lived streams (SSE) go through `proxyStreamToBackend` instead.
 */
export async function proxyToBackend(req: NextRequest, path: string[], session: Session | null): Promise<Response> {
	const target = buildTargetUrl(path, req.nextUrl.search)
	if (!target) return jsonError(400, 'Invalid backend path')

	const headers = forwardedRequestHeaders(req)

	if (session) {
		if (session.error) return jsonError(401, session.error)
		const accessToken = await getBackendAccessToken(req.headers)
		if (!accessToken) return jsonError(401, 'RefreshTokenError')
		headers.set('authorization', `Bearer ${accessToken}`)
	}

	const hasBody = req.method !== 'GET' && req.method !== 'HEAD'
	let upstream: Response
	try {
		upstream = await fetch(target, {
			method: req.method,
			headers,
			body: hasBody ? await req.arrayBuffer() : undefined,
			signal: req.signal,
			cache: 'no-store',
			redirect: 'manual',
		})
	} catch (error) {
		if (req.signal?.aborted) return new Response(null, { status: 499 })
		return jsonError(502, error instanceof Error ? `Backend unavailable: ${error.message}` : 'Backend unavailable')
	}

	const upstreamHeaders: [string, string][] = []
	upstream.headers.forEach((value, name) => {
		upstreamHeaders.push([name, value])
	})
	return new Response(upstream.body, {
		status: upstream.status,
		statusText: upstream.statusText,
		headers: proxiedResponseHeaders(upstreamHeaders),
	})
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

/**
 * Opens the upstream stream with node:http instead of fetch: undici's fetch
 * aborts a response body that stays idle for 300s (BodyTimeoutError), which
 * would cut long-lived SSE connections. node:http has no idle timeout by
 * default. Aborting `signal` (client disconnect) or cancelling the returned
 * body destroys the upstream request.
 */
function openUpstreamStream(target: URL, headers: Headers, signal: AbortSignal): Promise<Response> {
	return new Promise((resolve, reject) => {
		const client = target.protocol === 'https:' ? https : http
		const upstreamReq = client.request(
			target,
			{ method: 'GET', headers: Object.fromEntries(headers), signal },
			(res) => {
				const status = res.statusCode ?? 502
				const responseHeaders: [string, string][] = []
				for (const [name, value] of Object.entries(res.headers)) {
					if (value === undefined) continue
					responseHeaders.push([name, Array.isArray(value) ? value.join(', ') : value])
				}

				if (NULL_BODY_STATUSES.has(status)) {
					res.resume()
					resolve(new Response(null, { status, headers: proxiedResponseHeaders(responseHeaders) }))
					return
				}

				let finished = false
				const body = new ReadableStream<Uint8Array>({
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
							if (!finished) controller.enqueue(new Uint8Array(chunk))
						})
						res.on('end', () => finish())
						// A client disconnect ends the stream cleanly; other upstream failures surface as errors.
						res.on('error', (error) => finish(signal.aborted ? undefined : error))
						res.on('close', () => finish())
					},
					cancel() {
						finished = true
						upstreamReq.destroy()
					},
				})

				resolve(
					new Response(body, {
						status,
						statusText: res.statusMessage,
						headers: proxiedResponseHeaders(responseHeaders),
					}),
				)
			},
		)
		upstreamReq.on('error', reject)
		upstreamReq.end()
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

	const headers = forwardedRequestHeaders(req)
	headers.set('authorization', `Bearer ${accessToken}`)

	let upstream: Response
	try {
		upstream = await openUpstreamStream(target, headers, req.signal)
	} catch (error) {
		if (req.signal?.aborted) return new Response(null, { status: 499 })
		return jsonError(502, error instanceof Error ? `Backend unavailable: ${error.message}` : 'Backend unavailable')
	}

	// proxiedResponseHeaders already dropped any upstream Set-Cookie.
	return upstream
}
