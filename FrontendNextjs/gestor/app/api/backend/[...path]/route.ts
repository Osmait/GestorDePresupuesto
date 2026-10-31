import type { NextRequest } from 'next/server'
import type { Session } from 'next-auth'
import type { JWT } from 'next-auth/jwt'
import { auth } from '@/auth'
import { getBackendAccessToken } from '@/lib/auth/backend-token'
import { readSessionJwt } from '@/lib/auth/session-cookie'
import { hasFreshAccessToken } from '@/lib/auth/token-refresh'
import {
	isStreamingRequest,
	type ProxyCredentials,
	proxyStreamToBackend,
	proxyToBackend,
	rejectCrossOriginWrite,
} from '@/lib/server/backend-proxy'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface RouteContext {
	params: Promise<{ path: string[] }>
}

/** Route context passed through `auth()` to the refresh-path handler, with the cookie already decoded. */
interface RefreshPathContext extends RouteContext {
	decodedToken: JWT | null
}

async function credentialsFromSession(
	req: NextRequest,
	session: Session | null,
	decodedToken: JWT | null,
): Promise<ProxyCredentials> {
	if (!session) return null
	if (session.error) return { error: session.error }
	// Same cookie the jwt callback just processed: when it refreshed, the rotated
	// tokens come from the shared refresh store (no second /auth/refresh call).
	const accessToken = await getBackendAccessToken(req.headers, decodedToken)
	return accessToken ? { accessToken } : { error: 'RefreshTokenError' }
}

/**
 * Refresh path. Wrapping the handler in `auth()` runs the next-auth `jwt`
 * callback for the request, so a token refresh is persisted in the session
 * cookie of this response (Set-Cookie).
 */
const refreshPathHandler = auth(async (req, ctx) => {
	const { params, decodedToken } = ctx as RefreshPathContext
	const { path = [] } = await params
	return proxyToBackend(req, path, await credentialsFromSession(req, req.auth, decodedToken))
})

/**
 * Same-origin proxy to the Go backend for browser code.
 *
 * The session cookie is decoded once per request. While the access token is
 * valid and outside the refresh window, the `jwt` callback would return it
 * unchanged, so the request is forwarded with it directly: no callback, no
 * cookie re-encryption and no Set-Cookie. Only when the token is inside the
 * refresh window or expired (or there is no usable session) does the request
 * go through `auth()`, which refreshes (deduped) and persists the new cookie.
 */
async function handler(req: NextRequest, ctx: RouteContext): Promise<Response> {
	// Before the session is read: a cross-site write must not even trigger a refresh.
	const crossOrigin = rejectCrossOriginWrite(req)
	if (crossOrigin) return crossOrigin

	const { path = [] } = await ctx.params
	// Long-lived streams (SSE) bypass auth(): a Set-Cookie on a streaming
	// response can reach the browser minutes later and overwrite a newer,
	// already-rotated session cookie.
	if (isStreamingRequest(req, path)) return proxyStreamToBackend(req, path)

	const decodedToken = await readSessionJwt(req.headers)
	if (decodedToken && hasFreshAccessToken(decodedToken)) {
		return proxyToBackend(req, path, { accessToken: decodedToken.accessToken })
	}

	const refreshCtx: RefreshPathContext = { params: ctx.params, decodedToken }
	return (await refreshPathHandler(req, refreshCtx)) as Response
}

export { handler as DELETE, handler as GET, handler as PATCH, handler as POST, handler as PUT }
