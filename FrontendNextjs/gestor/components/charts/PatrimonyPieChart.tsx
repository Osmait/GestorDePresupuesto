'use client'

import { ResponsivePie } from '@nivo/pie'
import { useFormatPercent } from '@/hooks/useFormatPercent'
import { CHART_TOOLTIP_CLASS, useChartTheme } from './chart-theme'

interface PatrimonyPieChartProps {
	/** Slices in fixed entity order; `color` comes from `useChartTheme().colors.series`. */
	data: { label: string; value: number; color: string }[]
	total: number
	formatValue: (_value: number) => string
	/** Accessible name of the chart (its title); the values are appended for screen readers. */
	ariaLabel?: string
}

function percentOf(value: number, total: number) {
	return total > 0 ? (value / total) * 100 : 0
}

export default function PatrimonyPieChart({ data, total, formatValue, ariaLabel }: PatrimonyPieChartProps) {
	const { theme, colors } = useChartTheme(11)
	const formatPercent = useFormatPercent()
	const summary = data
		.map((datum) => `${datum.label}: ${formatValue(datum.value)} (${formatPercent(percentOf(datum.value, total))})`)
		.join(', ')

	return (
		<div role='img' aria-label={ariaLabel ? `${ariaLabel}. ${summary}` : summary} className='h-full w-full'>
			<ResponsivePie
				data={data.map((datum) => ({ id: datum.label, ...datum }))}
				margin={{ top: 20, right: 20, bottom: 40, left: 20 }}
				innerRadius={0.5}
				padAngle={2}
				cornerRadius={4}
				activeOuterRadiusOffset={8}
				colors={{ datum: 'data.color' }}
				borderWidth={0}
				enableArcLabels={false}
				enableArcLinkLabels={false}
				theme={theme}
				legends={[
					{
						anchor: 'bottom',
						direction: 'row',
						justify: false,
						translateX: 0,
						translateY: 30,
						itemsSpacing: 0,
						itemWidth: 90,
						itemHeight: 18,
						itemTextColor: colors.mutedText,
						itemDirection: 'left-to-right',
						itemOpacity: 1,
						symbolSize: 10,
						symbolShape: 'circle',
					},
				]}
				tooltip={({ datum }) => (
					<div className={CHART_TOOLTIP_CLASS}>
						<p className='text-xs font-medium'>{datum.label}</p>
						<p className='font-semibold tabular-nums'>{formatValue(datum.value as number)}</p>
						<p className='text-xs text-muted-foreground tabular-nums'>
							{formatPercent(percentOf(datum.value as number, total))}
						</p>
					</div>
				)}
			/>
		</div>
	)
}
