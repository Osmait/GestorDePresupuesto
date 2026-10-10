// No 'server-only' import here: instrumentation.ts is not compiled with the
// react-server condition, where that package throws.
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http'
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics'
import { registerOTel } from '@vercel/otel'

/** Escapes a string for use inside a RegExp. */
function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Registers the OpenTelemetry SDK through @vercel/otel, which works both on
 * Vercel and on a self-hosted `next start` (Railway/Docker):
 *
 * - traces: OTLP over HTTP to OTEL_EXPORTER_OTLP_ENDPOINT (protocol/headers
 *   from the standard OTEL_EXPORTER_OTLP_* variables); sampling from
 *   OTEL_TRACES_SAMPLER / OTEL_TRACES_SAMPLER_ARG (parent-based by default).
 * - fetch to the Go backend is traced AND carries a W3C `traceparent`, so the
 *   backend's spans join the same trace (`propagateContextUrls`).
 * - metrics (Web Vitals, see app/api/vitals) are pushed every 30s when
 *   OTEL_METRICS_EXPORTER is not "none".
 */
export function registerTelemetry() {
	// Same resolution as lib/backend-url.ts (which is server-only).
	const backendUrl = (
		process.env.BACKEND_URL ||
		process.env.NEXT_PUBLIC_BACKEND_URL ||
		'http://127.0.0.1:8080'
	).replace(/\/+$/, '')
	const metricsEnabled = (process.env.OTEL_METRICS_EXPORTER ?? 'otlp') !== 'none'

	registerOTel({
		serviceName: process.env.OTEL_SERVICE_NAME ?? 'gestor-frontend',
		attributes: {
			'deployment.environment.name': process.env.OTEL_ENVIRONMENT ?? process.env.VERCEL_ENV ?? process.env.NODE_ENV,
		},
		instrumentationConfig: {
			fetch: {
				propagateContextUrls: [new RegExp(`^${escapeRegExp(backendUrl)}(/|$)`)],
				// Never trace the exporter's own requests.
				ignoreUrls: [/\/v1\/(traces|metrics|logs)$/],
			},
		},
		metricReaders: metricsEnabled
			? [
					new PeriodicExportingMetricReader({
						exporter: new OTLPMetricExporter(),
						exportIntervalMillis: Number(process.env.OTEL_METRIC_EXPORT_INTERVAL ?? 30_000),
					}),
				]
			: [],
	})
}
