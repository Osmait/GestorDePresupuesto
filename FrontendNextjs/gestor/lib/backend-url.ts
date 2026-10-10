import 'server-only'

const DEFAULT_BACKEND_URL = 'http://127.0.0.1:8080'

/**
 * Base URL of the Go backend. Server-side only: the browser never talks to the
 * backend directly, it goes through the `/api/backend/*` proxy route.
 *
 * `BACKEND_URL` is the canonical variable. `NEXT_PUBLIC_BACKEND_URL` is still
 * read as a deprecated fallback so existing deployments keep working.
 */
export function getBackendUrl(): string {
	const url = process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || DEFAULT_BACKEND_URL
	return url.replace(/\/+$/, '')
}
