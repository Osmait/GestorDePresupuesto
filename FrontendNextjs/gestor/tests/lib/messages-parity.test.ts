import { describe, expect, it } from 'vitest'
import en from '@/messages/en.json'
import es from '@/messages/es.json'

function flattenKeys(value: unknown, prefix = ''): string[] {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) return [prefix]
	return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
		flattenKeys(child, prefix ? `${prefix}.${key}` : key),
	)
}

describe('message catalogs', () => {
	it('es.json and en.json define exactly the same keys', () => {
		const esKeys = new Set(flattenKeys(es))
		const enKeys = new Set(flattenKeys(en))
		expect(
			Array.from(esKeys)
				.filter((key) => !enKeys.has(key))
				.sort(),
		).toEqual([])
		expect(
			Array.from(enKeys)
				.filter((key) => !esKeys.has(key))
				.sort(),
		).toEqual([])
	})

	it('has no empty translations', () => {
		const empty = (catalog: unknown) =>
			flattenKeys(catalog).filter((key) => {
				const leaf = key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown>)?.[part], catalog)
				return typeof leaf !== 'string' || leaf.trim() === ''
			})
		expect(empty(es)).toEqual([])
		expect(empty(en)).toEqual([])
	})
})
