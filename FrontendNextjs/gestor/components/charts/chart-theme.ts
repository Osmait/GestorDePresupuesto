'use client'

import { useTheme } from 'next-themes'
import { useEffect, useMemo, useRef, useState } from 'react'

/**
 * The single theming path for Nivo charts.
 *
 * Every chart takes its `theme`, ink and series colors from `useChartTheme()`.
 * Colors come from the CSS tokens in styles/globals.css, keyed on next-themes'
 * `resolvedTheme` (never `theme`, which is 'system' for most users), and are
 * resolved to concrete color strings because Nivo animates colors with
 * react-spring, which cannot interpolate `var()` references.
 *
 * Do not hand-write Nivo themes with hex values in chart files. See DESIGN.md > Charts.
 */

/** Shared tooltip card for custom Nivo `tooltip` renderers. */
export const CHART_TOOLTIP_CLASS = 'rounded-lg border border-border bg-popover px-3 py-2 text-sm shadow-md'

/** Number of categorical series tokens (`--chart-1` … `--chart-8`). */
export const CHART_SERIES_COUNT = 8

const SERIES_TOKENS = ['chart-1', 'chart-2', 'chart-3', 'chart-4', 'chart-5', 'chart-6', 'chart-7', 'chart-8'] as const

const INK_TOKENS = {
	text: 'foreground',
	mutedText: 'muted-foreground',
	border: 'border',
	surface: 'popover',
	primary: 'primary',
	positive: 'success',
	negative: 'destructive',
	warning: 'warning',
	info: 'info',
} as const

type InkRole = keyof typeof INK_TOKENS
type TokenName = (typeof INK_TOKENS)[InkRole] | (typeof SERIES_TOKENS)[number]

const ALL_TOKENS: readonly TokenName[] = [...Object.values(INK_TOKENS), ...SERIES_TOKENS]

/** Token values used before the CSS is read (SSR, first paint, jsdom). Mirrors globals.css. */
const FALLBACK: Record<'light' | 'dark', Record<TokenName, string>> = {
	light: {
		foreground: '#09090b',
		'muted-foreground': '#71717a',
		border: '#e4e4e7',
		popover: '#ffffff',
		primary: '#18181b',
		success: '#157f3c',
		destructive: '#c81e1e',
		warning: '#b35309',
		info: '#0369a0',
		'chart-1': '#2a78d6',
		'chart-2': '#eb6834',
		'chart-3': '#1baf7a',
		'chart-4': '#eda100',
		'chart-5': '#e87ba4',
		'chart-6': '#008300',
		'chart-7': '#6250d6',
		'chart-8': '#e34948',
	},
	dark: {
		foreground: '#f9fafb',
		'muted-foreground': '#858b99',
		border: '#272930',
		popover: '#1a1b1e',
		primary: '#f9fafb',
		success: '#24c25e',
		destructive: '#f87272',
		warning: '#db7706',
		info: '#0da2e7',
		'chart-1': '#3987e5',
		'chart-2': '#d95926',
		'chart-3': '#199e70',
		'chart-4': '#c98500',
		'chart-5': '#d55181',
		'chart-6': '#008300',
		'chart-7': '#9085e9',
		'chart-8': '#e66767',
	},
}

function sameValues(a: Record<string, string>, b: Record<string, string>) {
	const keys = Object.keys(b)
	return keys.length === Object.keys(a).length && keys.every((key) => a[key] === b[key])
}

/**
 * Reads `--<name>` HSL tokens from <html> as `hsl(…)` strings and re-reads them
 * when the theme changes (next-themes toggles the `dark` class on <html>).
 */
function useTokenColors<const K extends string>(names: readonly K[], fallback: (name: K) => string): Record<K, string> {
	const { resolvedTheme } = useTheme()
	const key = names.join(',')
	const fallbackRef = useRef(fallback)
	fallbackRef.current = fallback
	const [colors, setColors] = useState<Record<K, string>>(
		() => Object.fromEntries(names.map((name) => [name, fallback(name)])) as Record<K, string>,
	)

	// biome-ignore lint/correctness/useExhaustiveDependencies: `key` encodes `names`; `resolvedTheme` triggers a re-read.
	useEffect(() => {
		const root = document.documentElement
		const read = () => {
			const style = getComputedStyle(root)
			const next = Object.fromEntries(
				names.map((name) => {
					const value = style.getPropertyValue(`--${name}`).trim()
					return [name, value ? `hsl(${value})` : fallbackRef.current(name)]
				}),
			) as Record<K, string>
			setColors((previous) => (sameValues(previous, next) ? previous : next))
		}
		read()
		// The class can land after this effect (provider effects run after children's).
		const observer = new MutationObserver(read)
		observer.observe(root, { attributes: true, attributeFilter: ['class', 'style'] })
		return () => observer.disconnect()
	}, [key, resolvedTheme])

	return colors
}

export interface ChartColors {
	/** Primary ink: labels that carry values, legend text on emphasis. */
	text: string
	/** Secondary ink: axis ticks, legends, captions. */
	mutedText: string
	/** Hairlines: grid, tick marks, tooltip border. */
	border: string
	/** Tooltip / popover surface. */
	surface: string
	primary: string
	/** Income, gains (same as `text-success`). */
	positive: string
	/** Expenses, losses (same as `text-destructive`). */
	negative: string
	warning: string
	info: string
	/**
	 * Categorical palette (`--chart-1` … `--chart-8`), validated for color
	 * vision deficiency in this order. Assign by entity in fixed order; never
	 * cycle past 8 (fold the rest into "Other").
	 */
	series: string[]
}

export interface ChartTheme {
	isDark: boolean
	/** Pass to every Nivo chart's `theme` prop. */
	theme: ReturnType<typeof buildNivoTheme>
	colors: ChartColors
}

function buildNivoTheme(colors: ChartColors, fontSize: number) {
	return {
		background: 'transparent',
		text: { fill: colors.mutedText, fontSize, fontFamily: 'inherit' },
		axis: {
			domain: { line: { stroke: 'transparent', strokeWidth: 0 } },
			ticks: {
				line: { stroke: colors.border, strokeWidth: 1 },
				text: { fill: colors.mutedText, fontSize },
			},
			legend: { text: { fill: colors.mutedText, fontSize, fontWeight: 500 } },
		},
		grid: {
			line: { stroke: colors.border, strokeWidth: 1, strokeDasharray: '3 3' },
		},
		legends: { text: { fill: colors.mutedText, fontSize } },
		labels: { text: { fill: colors.text, fontSize, fontWeight: 500 } },
		crosshair: {
			line: { stroke: colors.mutedText, strokeWidth: 1, strokeOpacity: 0.6, strokeDasharray: '4 4' },
		},
		tooltip: {
			container: {
				background: colors.surface,
				color: colors.text,
				fontSize,
				borderRadius: 8,
				border: `1px solid ${colors.border}`,
				boxShadow: '0 4px 12px rgb(0 0 0 / 0.12)',
				padding: '8px 12px',
			},
		},
	}
}

/**
 * Nivo theme + resolved token colors for the current light/dark mode.
 *
 * @example
 * const { theme, colors } = useChartTheme()
 * <ResponsiveBar theme={theme} colors={[colors.positive, colors.negative]} … />
 * <ResponsivePie theme={theme} colors={colors.series} arcLinkLabelsTextColor={colors.text} … />
 */
export function useChartTheme(fontSize = 12): ChartTheme {
	const { resolvedTheme } = useTheme()
	const isDark = resolvedTheme === 'dark'
	const mode = isDark ? 'dark' : 'light'
	const tokens = useTokenColors(ALL_TOKENS, (name) => FALLBACK[mode][name])

	return useMemo(() => {
		const ink = Object.fromEntries(
			(Object.keys(INK_TOKENS) as InkRole[]).map((role) => [role, tokens[INK_TOKENS[role]]]),
		) as Record<InkRole, string>
		const colors: ChartColors = { ...ink, series: SERIES_TOKENS.map((name) => tokens[name]) }
		return { isDark, theme: buildNivoTheme(colors, fontSize), colors }
	}, [isDark, tokens, fontSize])
}

/**
 * Resolves arbitrary `hsl(var(--name))` theme tokens to concrete colors.
 * Prefer `useChartTheme().colors`; use this only for a token it does not expose.
 */
export function useCssHslColors<const K extends string>(names: readonly K[], fallback: string): Record<K, string> {
	return useTokenColors(names, () => fallback)
}

/** Keeps at most `max` evenly spaced tick values (Nivo point scales label every point). */
export function pickTicks<T>(values: readonly T[], max: number): T[] {
	if (values.length <= max) return [...values]
	const step = Math.ceil(values.length / max)
	return values.filter((_, index) => index % step === 0)
}
