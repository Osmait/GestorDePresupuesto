import type { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { isStreamingRequest, proxyStreamToBackend, proxyToBackend } from '@/lib/server/backend-proxy'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

interface RouteContext {
	params: Promise<{ path: string[] }>
}

/**
 * Same-origin proxy to the Go backend for browser code. Wrapping the handler in
 * `auth()` runs the next-auth `jwt` callback for the request, so a token
 * refresh (if one was needed) is persisted in the session cookie of this response.
 */
const authedHandler = auth(async (req, ctx) => {
	const { path } = (await ctx.params) as { path?: string[] }
	return proxyToBackend(req, path ?? [], req.auth)
})

async function handler(req: NextRequest, ctx: RouteContext): Promise<Response> {
	const { path = [] } = await ctx.params
	// Long-lived streams (SSE) bypass auth(): a Set-Cookie on a streaming
	// response can reach the browser minutes later and overwrite a newer,
	// already-rotated session cookie.
	if (isStreamingRequest(req, path)) return proxyStreamToBackend(req, path)
	return (await authedHandler(req, ctx)) as Response
}

export { handler as DELETE, handler as GET, handler as PATCH, handler as POST, handler as PUT }
