// @vitest-environment node
import { createRequire } from 'node:module'
import type { NextConfig } from 'next'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const nextConfig = require('../../next.config.js') as NextConfig

async function headersFor(source: string): Promise<Record<string, string>> {
	const rules = (await nextConfig.headers?.()) ?? []
	const rule = rules.find((entry) => entry.source === source)
	return Object.fromEntries((rule?.headers ?? []).map(({ key, value }) => [key, value]))
}

describe('next.config.js security headers', () => {
	it('applies to every path', async () => {
		const rules = (await nextConfig.headers?.()) ?? []
		expect(rules.map((rule) => rule.source)).toContain('/:path*')
	})

	it('forbids framing and sniffing, and limits referrers and browser features', async () => {
		const headers = await headersFor('/:path*')

		expect(headers['X-Frame-Options']).toBe('DENY')
		expect(headers['X-Content-Type-Options']).toBe('nosniff')
		expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin')
		expect(headers['Permissions-Policy']).toBe(
			'camera=(), microphone=(), geolocation=(), payment=(), usb=(), publickey-credentials-get=(self), publickey-credentials-create=(self)',
		)
	})

	it('sends a CSP limited to directives that cannot break Next.js rendering', async () => {
		const csp = (await headersFor('/:path*'))['Content-Security-Policy']
		const directives = csp.split(';').map((directive) => directive.trim())

		expect(directives).toEqual(["frame-ancestors 'none'", "base-uri 'self'", "object-src 'none'", "form-action 'self'"])
		// Inline scripts/styles emitted by Next.js would need nonces under these.
		expect(csp).not.toMatch(/script-src|style-src|default-src/)
	})
})
