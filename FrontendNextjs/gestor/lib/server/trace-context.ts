import 'server-only'
import { context, propagation } from '@opentelemetry/api'

/**
 * Writes the active span's W3C `traceparent` / `tracestate` into outgoing
 * headers. A no-op when OpenTelemetry is not registered (the global
 * propagator does nothing), so it is safe to call unconditionally.
 *
 * fetch() calls to the backend are also propagated by @vercel/otel's fetch
 * instrumentation (which overwrites these with the fetch span's context);
 * this helper is what covers the raw node:http SSE path and keeps
 * propagation independent from that configuration.
 */
export function injectTraceContext(headers: Headers): Headers {
	propagation.inject(context.active(), headers, {
		set: (carrier, key, value) => carrier.set(key, value),
	})
	return headers
}

/** Same as `injectTraceContext` for plain header records. */
export function traceContextHeaders(): Record<string, string> {
	const carrier: Record<string, string> = {}
	propagation.inject(context.active(), carrier)
	return carrier
}

/**
 * A `Server-Timing` entry (https://w3c.github.io/server-timing/) for the time
 * the proxy waited for the backend's response headers, visible in the
 * browser devtools Network > Timing tab.
 */
export function upstreamServerTiming(startedAt: number, now: number = performance.now()): string {
	const dur = Math.max(0, now - startedAt)
	return `backend;desc="Go API";dur=${dur.toFixed(1)}`
}
