import { type Histogram, metrics } from '@opentelemetry/api'
import { normalizeRoute, parseSampleRate, type WebVitalName, webVitalSchema } from '@/lib/telemetry/web-vitals'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MAX_BODY_BYTES = 1024
/** Caps distinct route labels so a client cannot explode metric cardinality. */
const MAX_ROUTES = 100

const MS_BUCKETS = [50, 100, 200, 300, 500, 800, 1000, 1500, 2000, 2500, 3000, 4000, 6000, 10000]
const CLS_BUCKETS = [0.01, 0.025, 0.05, 0.1, 0.15, 0.25, 0.5, 1]

const histograms = new Map<WebVitalName, Histogram>()
const seenRoutes = new Set<string>()

function histogram(name: WebVitalName): Histogram {
	let h = histograms.get(name)
	if (!h) {
		const isCls = name === 'CLS'
		h = metrics.getMeter('gestor-frontend/web-vitals').createHistogram(`web_vitals.${name.toLowerCase()}`, {
			description: `Core Web Vital ${name} reported by sampled browsers`,
			unit: isCls ? '1' : 'ms',
			advice: { explicitBucketBoundaries: isCls ? CLS_BUCKETS : MS_BUCKETS },
		})
		histograms.set(name, h)
	}
	return h
}

function routeLabel(route: string): string {
	const normalized = normalizeRoute(route)
	if (seenRoutes.has(normalized)) return normalized
	if (seenRoutes.size >= MAX_ROUTES) return 'other'
	seenRoutes.add(normalized)
	return normalized
}

/**
 * Receives Web Vitals beacons (components/telemetry/web-vitals-reporter.tsx)
 * and records them as OpenTelemetry histograms (exported with the rest of the
 * frontend metrics when OTEL_EXPORTER_OTLP_ENDPOINT is set). Disabled — 404 —
 * unless WEB_VITALS_SAMPLE_RATE > 0.
 */
export async function POST(req: Request): Promise<Response> {
	if (parseSampleRate(process.env.WEB_VITALS_SAMPLE_RATE) <= 0) return new Response(null, { status: 404 })

	const text = await req.text()
	if (text.length > MAX_BODY_BYTES) return new Response(null, { status: 413 })

	let parsed: unknown
	try {
		parsed = JSON.parse(text)
	} catch {
		return new Response(null, { status: 400 })
	}
	const result = webVitalSchema.safeParse(parsed)
	if (!result.success) return new Response(null, { status: 400 })

	const { name, value, rating, route, navigationType } = result.data
	histogram(name).record(value, {
		route: routeLabel(route),
		rating,
		navigation_type: navigationType ?? 'unknown',
	})
	return new Response(null, { status: 204 })
}
