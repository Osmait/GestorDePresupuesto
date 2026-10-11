'use client'

import { ResponsiveBar } from '@nivo/bar'
import { useMemo } from 'react'
import { CHART_TOOLTIP_CLASS, useChartTheme } from './chart-theme'

// A type alias (not an interface) so it satisfies Nivo's indexed BarDatum.
export type HorizontalBarDatum = {
	name: string
	value: number
	color: string
}

interface HorizontalBarChartProps {
	data: HorizontalBarDatum[]
	formatValue: (_value: number) => string
	/** Width reserved for the category labels on the left. */
	labelWidth?: number
	fontSize?: number
	/** Labels longer than this are truncated on the axis (the tooltip shows the full name). */
	maxLabelLength?: number
	padding?: number
	/** Accessible name of the chart (its title); the values are appended for screen readers. */
	ariaLabel?: string
}

function truncate(label: string, max: number) {
	return label.length > max ? `${label.slice(0, max - 1)}…` : label
}

/** Horizontal bars, top to bottom in data order, no value axis, name + amount tooltip. */
export default function HorizontalBarChart({
	data,
	formatValue,
	labelWidth = 80,
	fontSize = 12,
	maxLabelLength = 14,
	padding = 0.25,
	ariaLabel,
}: HorizontalBarChartProps) {
	const { theme } = useChartTheme(fontSize)
	// Nivo draws the first horizontal bar at the bottom; reverse to keep the list order.
	const rows = useMemo(() => [...data].reverse(), [data])
	const summary = data.map((datum) => `${datum.name}: ${formatValue(datum.value)}`).join(', ')

	return (
		<div role='img' aria-label={ariaLabel ? `${ariaLabel}. ${summary}` : summary} className='h-full w-full'>
			<ResponsiveBar
				data={rows}
				keys={['value']}
				indexBy='name'
				layout='horizontal'
				margin={{ top: 5, right: 16, bottom: 5, left: labelWidth }}
				padding={padding}
				colors={({ data: datum }) => String(datum.color)}
				borderRadius={4}
				enableLabel={false}
				enableGridX={false}
				enableGridY={false}
				axisBottom={null}
				axisLeft={{
					tickSize: 0,
					tickPadding: 8,
					format: (value) => truncate(String(value), maxLabelLength),
				}}
				theme={theme}
				tooltip={({ indexValue, value }) => (
					<div className={CHART_TOOLTIP_CLASS}>
						<p className='font-semibold mb-1'>{indexValue}</p>
						<p className='tabular-nums'>{formatValue(Number(value))}</p>
					</div>
				)}
			/>
		</div>
	)
}
