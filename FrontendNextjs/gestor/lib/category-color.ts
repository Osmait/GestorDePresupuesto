/** Default category colors (user data, so raw hex is fine here); `key` names the label under `common.picker.colors`. */
export const CATEGORY_COLORS = [
	{ value: '#EF4444', key: 'red' },
	{ value: '#F97316', key: 'orange' },
	{ value: '#F59E0B', key: 'amber' },
	{ value: '#EAB308', key: 'yellow' },
	{ value: '#84CC16', key: 'lime' },
	{ value: '#22C55E', key: 'green' },
	{ value: '#10B981', key: 'emerald' },
	{ value: '#14B8A6', key: 'teal' },
	{ value: '#06B6D4', key: 'cyan' },
	{ value: '#0EA5E9', key: 'sky' },
	{ value: '#3B82F6', key: 'blue' },
	{ value: '#6366F1', key: 'indigo' },
	{ value: '#8B5CF6', key: 'violet' },
	{ value: '#A855F7', key: 'purple' },
	{ value: '#D946EF', key: 'fuchsia' },
	{ value: '#EC4899', key: 'pink' },
	{ value: '#F43F5E', key: 'rose' },
	{ value: '#64748B', key: 'slate' },
	{ value: '#6B7280', key: 'gray' },
	{ value: '#71717A', key: 'zinc' },
] as const

/** Color given to categories created on the fly (quick create, AI import): the palette's green. */
export const DEFAULT_CATEGORY_COLOR: string = CATEGORY_COLORS[5].value

const PALETTE_BY_NAME: Record<string, string> = {
	...Object.fromEntries(CATEGORY_COLORS.map(({ key, value }) => [key, value])),
	grey: '#6B7280',
}

/**
 * The palette color for a CSS color name. The API seeds the sign-up categories with names
 * ('green', 'orange', 'blue') and older categories may have them too; as CSS colors 'blue'
 * (#0000FF) and 'green' (#008000) are nearly invisible on the dark theme. Hex values and
 * anything else are returned as they are (trimmed).
 */
export function normalizeCategoryColor(color: string | null | undefined): string {
	const value = (color ?? '').trim()
	return PALETTE_BY_NAME[value.toLowerCase()] ?? value
}

/** Approximate chart surfaces (--card) of each theme, see styles/globals.css. */
const SURFACE: Record<'light' | 'dark', string> = { light: '#ffffff', dark: '#1a1b1f' }

/** WCAG 2.x minimum contrast for graphical objects (chart slices, legend swatches). */
const MIN_GRAPHIC_CONTRAST = 3

function parseHex(hex: string): [number, number, number] | null {
	const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex)
	if (!match) return null
	const digits = match[1].length === 3 ? [...match[1]].map((d) => d + d).join('') : match[1]
	return [0, 2, 4].map((i) => Number.parseInt(digits.slice(i, i + 2), 16)) as [number, number, number]
}

function toHex(rgb: readonly number[]): string {
	return `#${rgb.map((channel) => Math.round(channel).toString(16).padStart(2, '0')).join('')}`
}

function luminance([r, g, b]: readonly number[]): number {
	const linear = (channel: number) => {
		const c = channel / 255
		return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
	}
	return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
}

/** WCAG contrast ratio of two hex colors (1 to 21); NaN when one is not a hex color. */
export function contrastRatio(a: string, b: string): number {
	const rgbA = parseHex(a)
	const rgbB = parseHex(b)
	if (!rgbA || !rgbB) return Number.NaN
	const [light, dark] = [luminance(rgbA), luminance(rgbB)].sort((x, y) => y - x)
	return (light + 0.05) / (dark + 0.05)
}

/**
 * A category color that stands out (at least 3:1) from the chart surface of the theme:
 * the user's hue, darkened on the light theme or lightened on the dark one only as much
 * as needed. Colors that already contrast enough come back unchanged.
 */
export function readableCategoryColor(color: string | null | undefined, mode: 'light' | 'dark'): string {
	const normalized = normalizeCategoryColor(color)
	const rgb = parseHex(normalized)
	if (!rgb) return normalized
	const surface = SURFACE[mode]
	const target = mode === 'dark' ? 255 : 0
	for (let step = 0; step <= 20; step++) {
		const mixed = rgb.map((channel) => channel + (target - channel) * (step / 20))
		const candidate = toHex(mixed)
		if (contrastRatio(candidate, surface) >= MIN_GRAPHIC_CONTRAST) {
			return step === 0 ? normalized : candidate
		}
	}
	return normalized
}
