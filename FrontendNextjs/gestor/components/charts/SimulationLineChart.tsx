'use client'

import { ResponsiveLine } from '@nivo/line'
import { useMemo } from 'react'
import { CHART_TOOLTIP_CLASS, pickTicks, useChartTheme, useCssHslColors } from './chart-theme'

interface SimulationLineChartProps {
	/** One row per month: capital and capital + accumulated net interest. */
	rows: { month: number; capital: number; totalWithNet: number }[]
	labels: { capital: string; totalWithNet: string; month: (_month: number) => string }
	formatValue: (_value: number) => string
}

const THEME_COLORS = ['success', 'primary'] as const

/** Two monotone lines (capital vs capital + net) for the certificate payment simulator. */
export default function SimulationLineChart({ rows, labels, formatValue }: SimulationLineChartProps) {
	const { theme } = useChartTheme(11)
	const colors = useCssHslColors(THEME_COLORS, '#64748b')

	const { data, ticks } = useMemo(
		() => ({
			data: [
				{
					id: 'capital',
					color: colors.success,
					data: rows.map((row) => ({ x: row.month, y: row.capital })),
				},
				{
					id: 'totalWithNet',
					color: colors.primary,
					data: rows.map((row) => ({ x: row.month, y: row.totalWithNet })),
				},
			],
			ticks: pickTicks(
				rows.map((row) => row.month),
				12,
			),
		}),
		[rows, colors],
	)

	return (
		<ResponsiveLine
			data={data}
			margin={{ top: 8, right: 12, bottom: 28, left: 44 }}
			xScale={{ type: 'point' }}
			yScale={{ type: 'linear', min: 'auto', max: 'auto' }}
			curve='monotoneX'
			colors={(series) => String(series.color)}
			lineWidth={2}
			enablePoints={false}
			enableGridX={false}
			gridYValues={5}
			axisBottom={{ tickSize: 0, tickPadding: 8, tickValues: ticks }}
			axisLeft={{
				tickSize: 0,
				tickPadding: 8,
				tickValues: 5,
				format: (value) => `${Math.round(Number(value) / 1000)}k`,
			}}
			theme={theme}
			enableSlices='x'
			sliceTooltip={({ slice }) => (
				<div className={CHART_TOOLTIP_CLASS}>
					<p className='font-semibold mb-1'>{labels.month(Number(slice.points[0]?.data.x))}</p>
					{slice.points.map((point) => (
						<p key={point.id} className='tabular-nums' style={{ color: point.seriesColor }}>
							{point.seriesId === 'capital' ? labels.capital : labels.totalWithNet}: {formatValue(Number(point.data.y))}
						</p>
					))}
				</div>
			)}
		/>
	)
}
