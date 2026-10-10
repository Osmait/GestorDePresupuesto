import { z } from 'zod'

/** Core Web Vitals reported by Next's `useReportWebVitals`. */
export const WEB_VITAL_NAMES = ['CLS', 'FCP', 'INP', 'LCP', 'TTFB', 'FID'] as const
export type WebVitalName = (typeof WEB_VITAL_NAMES)[number]

export const webVitalSchema = z.object({
	name: z.enum(WEB_VITAL_NAMES),
	value: z.number().finite().nonnegative().max(600_000),
	rating: z.enum(['good', 'needs-improvement', 'poor']),
	route: z.string().max(200),
	navigationType: z.string().max(32).optional(),
})
export type WebVitalReport = z.infer<typeof webVitalSchema>

/** Parses a 0..1 sample rate; anything invalid disables reporting. */
export function parseSampleRate(raw: string | undefined): number {
	const rate = Number(raw)
	if (!raw || !Number.isFinite(rate) || rate <= 0) return 0
	return Math.min(rate, 1)
}

const ID_SEGMENT =
	/^(\d+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|(?=[a-z0-9_-]*\d)[a-z0-9_-]{16,})$/i
const WORD_SEGMENT = /^[a-z][a-z-]{0,39}$/
const MAX_SEGMENTS = 5

/**
 * Turns a pathname into a low-cardinality route label: ids (numbers, UUIDs,
 * long tokens) become ":id", anything unexpected becomes ":param", and the
 * query string is dropped. `/app/accounts/3f2a…/edit?x=1` → `/app/accounts/:id/edit`.
 */
export function normalizeRoute(pathname: string): string {
	const path = pathname.split(/[?#]/, 1)[0] ?? ''
	const segments = path.split('/').filter(Boolean).slice(0, MAX_SEGMENTS)
	const normalized = segments.map((segment) => {
		if (segment === ':id' || segment === ':param') return segment
		if (ID_SEGMENT.test(segment)) return ':id'
		return WORD_SEGMENT.test(segment) ? segment.toLowerCase() : ':param'
	})
	return `/${normalized.join('/')}`
}
