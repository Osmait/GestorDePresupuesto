'use client'

import { ResponsivePie } from '@nivo/pie'
import { useFormatPercent } from '@/hooks/useFormatPercent'
import { CHART_TOOLTIP_CLASS, useChartTheme } from './chart-theme'

export interface AllocationSlice {
	id: string
	label: string
	value: number
	/** Series color; take it from `useChartTheme().colors.series` in a fixed order per type. */
	color: string
}

interface InvestmentAllocationChartProps {
	data: AllocationSlice[]
	totalValue: number
	formatValue: (_value: number) => string
}

/** Donut of portfolio value per investment type. */
export default function InvestmentAllocationChart({ data, totalValue, formatValue }: InvestmentAllocationChartProps) {
	const { theme, colors } = useChartTheme(11)
	const formatPercent = useFormatPercent()

	return (
		<ResponsivePie
			data={data}
			margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
			innerRadius={0.6}
			padAngle={0.5}
			cornerRadius={3}
			activeOuterRadiusOffset={8}
			colors={{ datum: 'data.color' }}
			borderWidth={0}
			enableArcLinkLabels
			arcLinkLabelsSkipAngle={10}
			arcLinkLabelsTextColor={colors.text}
			arcLinkLabelsThickness={2}
			arcLinkLabelsColor={{ from: 'color' }}
			enableArcLabels={false}
			theme={theme}
			tooltip={({ datum }) => (
				<div className={CHART_TOOLTIP_CLASS}>
					<span className='mr-2 inline-block h-2.5 w-2.5 rounded-full' style={{ backgroundColor: datum.color }} />
					<span className='font-medium'>{datum.label}</span>
					<span className='ml-2 tabular-nums'>
						{formatValue(datum.value)}
						{totalValue > 0 ? ` (${formatPercent((datum.value / totalValue) * 100)})` : ''}
					</span>
				</div>
			)}
		/>
	)
}
