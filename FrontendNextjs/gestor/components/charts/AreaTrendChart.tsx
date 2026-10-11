'use client'

import { linearGradientDef } from '@nivo/core'
import { ResponsiveLine } from '@nivo/line'
import { useId, useMemo } from 'react'
import { CHART_TOOLTIP_CLASS, pickTicks, useChartTheme } from './chart-theme'

export interface AreaTrendPoint {
	/** Axis label (several points may share one, e.g. the same day). */
	label: string
	/** Tooltip title; defaults to `label`. */
	tooltipLabel?: string
	value: number
}

interface AreaTrendChartProps {
	points: AreaTrendPoint[]
	color: string
	/** Series name shown in the tooltip ("Balance", "Value"). */
	seriesLabel: string
	formatValue: (_value: number) => string
	maxTicks?: number
	/** Accessible name of the chart (its title). Defaults to the series label; first/last values are appended. */
	ariaLabel?: string
}

/**
 * Single-series area chart with a vertical fade (the former Recharts
 * `AreaChart`): hidden auto-scaled Y axis, dashed horizontal grid and a
 * label + value tooltip. Points are indexed, so repeated labels are kept.
 */
export default function AreaTrendChart({
	points,
	color,
	seriesLabel,
	formatValue,
	maxTicks = 8,
	ariaLabel,
}: AreaTrendChartProps) {
	const { theme } = useChartTheme(12)
	// The fade uses the concrete color, not Nivo's `inherit`: Nivo derives the gradient id from the
	// resolved color, and an `hsl(213 67% 50%)` token puts spaces and parentheses in that id, which
	// breaks the `url(#…)` reference and paints the area black.
	const gradientId = `areaTrendFade-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
	const first = points[0]
	const last = points[points.length - 1]
	const summary =
		first && last ? `${first.label}: ${formatValue(first.value)}, ${last.label}: ${formatValue(last.value)}` : ''
	const label = [ariaLabel ?? seriesLabel, summary].filter(Boolean).join('. ')

	const { data, min, ticks } = useMemo(() => {
		const values = points.map((point) => point.value)
		return {
			data: [{ id: seriesLabel, data: points.map((point, index) => ({ x: index, y: point.value })) }],
			min: values.length > 0 ? Math.min(...values) : 0,
			ticks: pickTicks(
				points.map((_, index) => index),
				maxTicks,
			),
		}
	}, [points, seriesLabel, maxTicks])

	return (
		<div role='img' aria-label={label} className='h-full w-full'>
			<ResponsiveLine
				data={data}
				margin={{ top: 10, right: 28, bottom: 28, left: 28 }}
				xScale={{ type: 'point' }}
				yScale={{ type: 'linear', min: 'auto', max: 'auto' }}
				curve='monotoneX'
				colors={[color]}
				lineWidth={2}
				// A single point draws no line: show it as a dot (like Recharts did).
				enablePoints={points.length === 1}
				pointSize={8}
				enableArea
				areaBaselineValue={min}
				areaOpacity={1}
				defs={[
					linearGradientDef(gradientId, [
						{ offset: 5, color, opacity: 0.8 },
						{ offset: 95, color, opacity: 0 },
					]),
				]}
				fill={[{ match: '*', id: gradientId }]}
				enableGridX={false}
				gridYValues={5}
				axisLeft={null}
				axisBottom={{
					tickSize: 0,
					tickPadding: 10,
					tickValues: ticks,
					format: (index) => points[Number(index)]?.label ?? '',
				}}
				theme={theme}
				useMesh
				tooltip={({ point }) => {
					const source = points[Number(point.data.x)]
					return (
						<div className={CHART_TOOLTIP_CLASS}>
							<p className='font-semibold'>{source?.tooltipLabel ?? source?.label}</p>
							<p className='tabular-nums'>
								{seriesLabel}: {formatValue(Number(point.data.y))}
							</p>
						</div>
					)
				}}
			/>
		</div>
	)
}
