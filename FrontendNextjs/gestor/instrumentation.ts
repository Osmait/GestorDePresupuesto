/**
 * Next.js instrumentation hook (runs once per server process).
 *
 * OpenTelemetry is OFF unless OTEL_EXPORTER_OTLP_ENDPOINT (or the
 * traces-specific variable) is set, so default deployments are unchanged.
 * Only the Node.js runtime is instrumented: the edge middleware only decodes
 * the session cookie and is not worth a span.
 */
export async function register() {
	if (process.env.NEXT_RUNTIME !== 'nodejs') return
	if (!process.env.OTEL_EXPORTER_OTLP_ENDPOINT && !process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT) return
	const { registerTelemetry } = await import('./lib/server/telemetry/register')
	registerTelemetry()
}
