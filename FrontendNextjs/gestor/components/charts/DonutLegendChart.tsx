'use client'

import { ResponsivePie } from '@nivo/pie'
import { useMemo } from 'react'
import { CHART_TOOLTIP_CLASS, useChartTheme } from './chart-theme'

export interface DonutDatum {
	name: string
	value: number
	color: string
}

interface DonutLegendChartProps {
	data: DonutDatum[]
	formatValue: (_value: number) => string
	/** Accessible name of the chart (its title); the values are appended for screen readers. */
	ariaLabel?: string
}

/** Small donut with a vertical legend on the right (the former Recharts Pie + Legend). */
export default function DonutLegendChart({ data, formatValue, ariaLabel }: DonutLegendChartProps) {
	const { theme } = useChartTheme(12)
	// Ids must be unique (two categories may share a name, e.g. "No category").
	const slices = useMemo(
		() => data.map((datum, index) => ({ id: `${index}`, label: datum.name, value: datum.value, color: datum.color })),
		[data],
	)
	const summary = data.map((datum) => `${datum.name}: ${formatValue(datum.value)}`).join(', ')

	return (
		<div className='flex h-full min-w-0 items-center gap-3'>
			<div role='img' aria-label={ariaLabel ? `${ariaLabel}. ${summary}` : summary} className='h-full min-w-0 flex-1'>
				<ResponsivePie
					data={slices}
					margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
					innerRadius={0.67}
					padAngle={2}
					colors={{ datum: 'data.color' }}
					enableArcLabels={false}
					enableArcLinkLabels={false}
					activeOuterRadiusOffset={4}
					theme={theme}
					tooltip={({ datum }) => (
						<div className={CHART_TOOLTIP_CLASS}>
							<p className='font-semibold mb-1'>{datum.label}</p>
							<p className='tabular-nums'>{formatValue(Number(datum.value))}</p>
						</div>
					)}
				/>
			</div>
			<ul className='max-w-[50%] shrink-0 space-y-1 text-xs'>
				{slices.map((slice) => (
					<li key={slice.id} className='flex min-w-0 items-center gap-2'>
						<span
							className='h-2.5 w-2.5 shrink-0 rounded-sm'
							style={{ backgroundColor: slice.color }}
							aria-hidden='true'
						/>
						<span className='truncate text-muted-foreground'>{slice.label}</span>
					</li>
				))}
			</ul>
		</div>
	)
}
