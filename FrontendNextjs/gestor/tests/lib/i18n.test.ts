import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_LOCALE, resolveLocale } from '@/lib/i18n/locales'

let cookieValue: string | undefined

vi.mock('next/headers', () => ({
	cookies: async () => ({
		get: (name: string) => (name === 'locale' && cookieValue !== undefined ? { value: cookieValue } : undefined),
	}),
}))

// getRequestConfig just returns the factory so the test can invoke it directly.
vi.mock('next-intl/server', () => ({
	getRequestConfig: (factory: unknown) => factory,
}))

describe('resolveLocale', () => {
	it('accepts whitelisted locales', () => {
		expect(resolveLocale('es')).toBe('es')
		expect(resolveLocale('en')).toBe('en')
	})

	it.each([undefined, null, '', 'fr', 'EN', '../../package', 'en/../es', 'es.json'])(
		'falls back to es for %s',
		(value) => {
			expect(resolveLocale(value)).toBe(DEFAULT_LOCALE)
			expect(DEFAULT_LOCALE).toBe('es')
		},
	)
})

describe('i18n request config', () => {
	beforeEach(() => {
		cookieValue = undefined
	})

	async function loadConfig() {
		const { default: factory } = await import('@/i18n')
		return (factory as unknown as () => Promise<{ locale: string; messages: Record<string, unknown> }>)()
	}

	it('uses the locale cookie when it is supported', async () => {
		cookieValue = 'en'
		const config = await loadConfig()
		expect(config.locale).toBe('en')
		expect(config.messages).toBeTypeOf('object')
	})

	it('falls back to es for an unsupported or malicious cookie', async () => {
		cookieValue = '../../package'
		const config = await loadConfig()
		expect(config.locale).toBe('es')
		expect(config.messages).toBeTypeOf('object')
	})
})
