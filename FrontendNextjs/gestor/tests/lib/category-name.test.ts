import { describe, expect, it } from 'vitest'
import { buildUniqueCategoryName } from '@/lib/category-name'
import en from '@/messages/en.json'
import es from '@/messages/es.json'

const english = { fallback: en.categories.suggestedNameFallback, suffix: en.categories.aiSuggestedSuffix }
const spanish = { fallback: es.categories.suggestedNameFallback, suffix: es.categories.aiSuggestedSuffix }

describe('buildUniqueCategoryName', () => {
	it('keeps a name nobody uses, trimmed', () => {
		expect(buildUniqueCategoryName('  Groceries ', ['Rent'], english)).toBe('Groceries')
	})

	it('adds the AI suffix when the name is taken (case-insensitively)', () => {
		expect(buildUniqueCategoryName('groceries', ['Groceries'], english)).toBe('groceries (AI)')
		expect(buildUniqueCategoryName('Comida', ['comida'], spanish)).toBe('Comida (IA)')
	})

	it('numbers the suffix until the name is free', () => {
		expect(buildUniqueCategoryName('Food', ['Food', 'Food (AI)', 'food (ai 2)'], english)).toBe('Food (AI 3)')
	})

	it('uses the translated fallback for a blank suggestion', () => {
		expect(buildUniqueCategoryName('  ', [], english)).toBe('New category')
		expect(buildUniqueCategoryName('', ['Nueva categoría'], spanish)).toBe('Nueva categoría (IA)')
	})

	it('returns an already unique name unchanged (applying it twice is harmless)', () => {
		const existing = ['Food']
		const once = buildUniqueCategoryName('Food', existing, english)
		expect(buildUniqueCategoryName(once, existing, english)).toBe(once)
	})
})
