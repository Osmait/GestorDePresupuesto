// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const recorded: { name: string; value: number; attrs: Record<string, unknown> }[] = []
vi.mock('@opentelemetry/api', () => ({
	metrics: {
		getMeter: () => ({
			createHistogram: (name: string) => ({
				record: (value: number, attrs: Record<string, unknown>) => recorded.push({ name, value, attrs }),
			}),
		}),
	},
}))

import { POST } from '@/app/api/vitals/route'

function beacon(body: unknown) {
	return new Request('http://localhost:3000/api/vitals', {
		method: 'POST',
		body: typeof body === 'string' ? body : JSON.stringify(body),
	})
}

describe('POST /api/vitals', () => {
	beforeEach(() => {
		recorded.length = 0
	})
	afterEach(() => {
		delete process.env.WEB_VITALS_SAMPLE_RATE
	})

	it('is disabled (404) unless WEB_VITALS_SAMPLE_RATE > 0', async () => {
		const res = await POST(beacon({ name: 'LCP', value: 1, rating: 'good', route: '/app' }))
		expect(res.status).toBe(404)
		expect(recorded).toHaveLength(0)
	})

	it('records a histogram sample with a normalized, low-cardinality route', async () => {
		process.env.WEB_VITALS_SAMPLE_RATE = '0.1'
		const res = await POST(
			beacon({ name: 'INP', value: 88, rating: 'good', route: '/app/accounts/123456', navigationType: 'navigate' }),
		)
		expect(res.status).toBe(204)
		expect(recorded).toEqual([
			{
				name: 'web_vitals.inp',
				value: 88,
				attrs: { route: '/app/accounts/:id', rating: 'good', navigation_type: 'navigate' },
			},
		])
	})

	it('rejects malformed or oversized payloads', async () => {
		process.env.WEB_VITALS_SAMPLE_RATE = '1'
		expect((await POST(beacon('not json'))).status).toBe(400)
		expect((await POST(beacon({ name: 'LCP', value: 'x', rating: 'good', route: '/' }))).status).toBe(400)
		expect((await POST(beacon('x'.repeat(2000)))).status).toBe(413)
		expect(recorded).toHaveLength(0)
	})
})
