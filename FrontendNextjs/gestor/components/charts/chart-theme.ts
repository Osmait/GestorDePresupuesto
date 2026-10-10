'use client'

import { useTheme } from 'next-themes'
import { useEffect, useMemo, useState } from 'react'

/** Shared look of the small Nivo charts (axis ticks, dashed horizontal grid, tooltip card). */
export const CHART_TICK_COLOR = '#6b7280'
export const CHART_TOOLTIP_CLASS = 'rounded-lg border border-border bg-popover px-3 py-2 text-sm shadow-md'

export function useChartTheme(fontSize = 12) {
	const { resolvedTheme } = useTheme()
	const isDark = resolvedTheme === 'dark'
	return useMemo(
		() => ({
			isDark,
			theme: {
				background: 'transparent',
				text: { fill: CHART_TICK_COLOR, fontSize },
				axis: { ticks: { text: { fill: CHART_TICK_COLOR, fontSize } } },
				grid: {
					line: {
						stroke: isDark ? '#1f2937' : '#e5e7eb',
						strokeWidth: 1,
						strokeDasharray: '3 3',
					},
				},
			},
		}),
		[isDark, fontSize],
	)
}

/**
 * Resolves `hsl(var(--name))` theme tokens to concrete colors: Nivo animates
 * colors with react-spring, which cannot interpolate `var()` references.
 */
export function useCssHslColors<const K extends string>(names: readonly K[], fallback: string): Record<K, string> {
	const { resolvedTheme } = useTheme()
	const key = names.join(',')
	const [colors, setColors] = useState<Record<K, string>>(
		() => Object.fromEntries(names.map((name) => [name, fallback])) as Record<K, string>,
	)

	// biome-ignore lint/correctness/useExhaustiveDependencies: `key` encodes `names`; re-read when the theme changes.
	useEffect(() => {
		const style = getComputedStyle(document.documentElement)
		setColors(
			Object.fromEntries(
				names.map((name) => {
					const value = style.getPropertyValue(`--${name}`).trim()
					return [name, value ? `hsl(${value})` : fallback]
				}),
			) as Record<K, string>,
		)
	}, [key, resolvedTheme, fallback])

	return colors
}

/** Keeps at most `max` evenly spaced tick values (Nivo point scales label every point). */
export function pickTicks<T>(values: readonly T[], max: number): T[] {
	if (values.length <= max) return [...values]
	const step = Math.ceil(values.length / max)
	return values.filter((_, index) => index % step === 0)
}
