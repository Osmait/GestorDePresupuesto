'use client'

import { useReportWebVitals } from 'next/web-vitals'
import { useCallback, useState } from 'react'
import { normalizeRoute } from '@/lib/telemetry/web-vitals'

type ReportedMetric = Parameters<Parameters<typeof useReportWebVitals>[0]>[0]

const ENDPOINT = '/api/vitals'

function send(body: string) {
	if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
		if (navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }))) return
	}
	void fetch(ENDPOINT, {
		method: 'POST',
		body,
		keepalive: true,
		headers: { 'content-type': 'application/json' },
	}).catch(() => undefined)
}

/**
 * Reports Core Web Vitals for a sampled fraction of page loads to
 * /api/vitals, which records them as OpenTelemetry histograms. Rendered by the
 * root layout only when WEB_VITALS_SAMPLE_RATE > 0 (off by default).
 */
export function WebVitalsReporter({ sampleRate }: { sampleRate: number }) {
	// Decide once per page load so all vitals of a sampled view are kept.
	const [sampled] = useState(() => Math.random() < sampleRate)
	const report = useCallback(
		(metric: ReportedMetric) => {
			if (!sampled) return
			send(
				JSON.stringify({
					name: metric.name,
					value: metric.value,
					rating: metric.rating,
					route: normalizeRoute(window.location.pathname),
					navigationType: metric.navigationType,
				}),
			)
		},
		[sampled],
	)
	useReportWebVitals(report)
	return null
}
