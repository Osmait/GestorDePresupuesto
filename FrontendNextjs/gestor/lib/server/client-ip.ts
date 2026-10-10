import 'server-only'
import { isIP } from 'node:net'
import { headers as incomingHeaders } from 'next/headers'

/**
 * The browser never calls the backend directly: the `/api/backend/*` proxy,
 * Server Components and next-auth call it from this server, so the backend
 * would see this server's egress IP for every user (one shared bucket for its
 * per-IP rate limits and login lockout). Server-side calls therefore send the
 * browser's IP in `X-Client-IP`, authenticated by `PROXY_SHARED_SECRET` in
 * `X-Proxy-Secret`; the backend only honours the IP when the secret matches.
 *
 * Only set PROXY_SHARED_SECRET where the platform's edge overwrites
 * `x-real-ip` / `x-forwarded-for` with the connecting client's IP (Vercel
 * does): otherwise a browser could pick its own IP.
 */
export const CLIENT_IP_HEADER = 'X-Client-IP'
export const PROXY_SECRET_HEADER = 'X-Proxy-Secret'

type HeaderSource = Pick<Headers, 'get'>

function validIp(value: string | null | undefined): string | null {
	const ip = value?.trim()
	return ip && isIP(ip) !== 0 ? ip : null
}

/**
 * The browser's IP from the incoming request headers: `x-real-ip`, else the
 * first (client) entry of `x-forwarded-for`. Null when neither is a valid IP.
 */
export function getClientIp(headers: HeaderSource): string | null {
	return validIp(headers.get('x-real-ip')) ?? validIp(headers.get('x-forwarded-for')?.split(',')[0])
}

function getProxySecret(): string | null {
	return process.env.PROXY_SHARED_SECRET?.trim() || null
}

/**
 * Headers to add to a backend request made on behalf of the request carrying
 * `headers`. Empty when PROXY_SHARED_SECRET is unset or the client IP is
 * unknown (an IP is never fabricated; the backend then uses the peer IP).
 */
export function clientIpHeaders(headers: HeaderSource | null | undefined): Record<string, string> {
	const secret = getProxySecret()
	if (!secret || !headers) return {}
	const ip = getClientIp(headers)
	if (!ip) return {}
	return { [CLIENT_IP_HEADER]: ip, [PROXY_SECRET_HEADER]: secret }
}

/**
 * `clientIpHeaders` for code that does not get the incoming request (e.g. the
 * token refresh inside the next-auth `jwt` callback): reads it through
 * `next/headers`. Empty outside a request scope. Every caller already runs in a
 * dynamic, cookie-reading context, so `headers()` never has to bail out of
 * static rendering here.
 */
export async function currentClientIpHeaders(): Promise<Record<string, string>> {
	if (!getProxySecret()) return {}
	try {
		return clientIpHeaders(await incomingHeaders())
	} catch {
		return {}
	}
}
