'use client'

import { ResponsivePie } from '@nivo/pie'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { useChartTheme } from './chart-theme'

export interface AnalysisPieDatum {
	id: string
	label: string
	value: number
	/** The category's own color (user data); falls back to the series palette. */
	color?: string
}

interface AnalysisPieChartProps {
	data: AnalysisPieDatum[]
	/** Accessible name of the chart (role="img"). */
	label: string
}

const AnalysisPieChart = ({ data, label }: AnalysisPieChartProps) => {
	const { theme, colors } = useChartTheme(11)
	const formatCurrency = useFormatCurrency()
	const slices = data.map((datum, index) => ({
		...datum,
		color: datum.color || colors.series[index % colors.series.length],
	}))

	return (
		<div role='img' aria-label={label} className='h-full w-full'>
			<ResponsivePie
				data={slices}
				colors={{ datum: 'data.color' }}
				margin={{ top: 24, right: 72, bottom: 24, left: 72 }}
				innerRadius={0.55}
				padAngle={0.7}
				cornerRadius={3}
				activeOuterRadiusOffset={6}
				borderWidth={1}
				borderColor={colors.surface}
				arcLinkLabelsSkipAngle={10}
				arcLinkLabel={(d) => String(d.label)}
				arcLinkLabelsTextColor={colors.text}
				arcLinkLabelsThickness={2}
				arcLinkLabelsColor={{ from: 'color' }}
				enableArcLabels={false}
				valueFormat={(value) => formatCurrency(Number(value), 'DOP')}
				theme={theme}
			/>
		</div>
	)
}

export default AnalysisPieChart
