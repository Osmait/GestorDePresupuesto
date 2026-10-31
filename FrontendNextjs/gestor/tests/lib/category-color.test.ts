import { describe, expect, it } from 'vitest'
import { CATEGORY_COLORS, contrastRatio, normalizeCategoryColor, readableCategoryColor } from '@/lib/category-color'

const LIGHT_SURFACE = '#ffffff'
const DARK_SURFACE = '#1a1b1f'

describe('normalizeCategoryColor', () => {
	it('maps the CSS names the API seeds to the palette', () => {
		expect(normalizeCategoryColor('green')).toBe('#22C55E')
		expect(normalizeCategoryColor(' Blue ')).toBe('#3B82F6')
		expect(normalizeCategoryColor('orange')).toBe('#F97316')
		expect(normalizeCategoryColor('grey')).toBe('#6B7280')
	})

	it('keeps hex colors and unknown values as they are', () => {
		expect(normalizeCategoryColor('#123456')).toBe('#123456')
		expect(normalizeCategoryColor('rgb(1, 2, 3)')).toBe('rgb(1, 2, 3)')
		expect(normalizeCategoryColor(undefined)).toBe('')
	})
})

describe('readableCategoryColor', () => {
	it('gives every palette color and seeded name at least 3:1 against the card in both themes', () => {
		for (const color of [...CATEGORY_COLORS.map((c) => c.value), 'blue', 'green', 'orange', '#0000ff', '#ffff00']) {
			expect(
				contrastRatio(readableCategoryColor(color, 'light'), LIGHT_SURFACE),
				`${color} light`,
			).toBeGreaterThanOrEqual(3)
			expect(contrastRatio(readableCategoryColor(color, 'dark'), DARK_SURFACE), `${color} dark`).toBeGreaterThanOrEqual(
				3,
			)
		}
	})

	it('leaves colors that already contrast enough unchanged', () => {
		expect(readableCategoryColor('#3B82F6', 'dark')).toBe('#3B82F6')
		expect(readableCategoryColor('#3B82F6', 'light')).toBe('#3B82F6')
	})

	it('lightens a dark color on the dark theme and darkens a light one on the light theme', () => {
		const onDark = readableCategoryColor('#0000ff', 'dark')
		expect(onDark).not.toBe('#0000ff')
		expect(contrastRatio(onDark, '#000000')).toBeGreaterThan(contrastRatio('#0000ff', '#000000'))

		const onLight = readableCategoryColor('#EAB308', 'light')
		expect(onLight).not.toBe('#EAB308')
		expect(contrastRatio(onLight, '#ffffff')).toBeGreaterThan(contrastRatio('#EAB308', '#ffffff'))
	})

	it('returns non-hex values untouched', () => {
		expect(readableCategoryColor('', 'dark')).toBe('')
		expect(readableCategoryColor('hsl(var(--chart-1))', 'light')).toBe('hsl(var(--chart-1))')
	})
})
