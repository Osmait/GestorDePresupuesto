'use client'

import { ResponsiveRadar } from '@nivo/radar'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { useChartTheme } from './chart-theme'

interface AnalysisRadarChartProps {
	data: Record<string, string | number>[]
	/** Accessible name of the chart (role="img"). */
	label: string
	t: {
		expenses: string
	}
}

const AnalysisRadarChart = ({ data, label, t }: AnalysisRadarChartProps) => {
	const { theme, colors } = useChartTheme(11)
	const formatCurrency = useFormatCurrency()

	return (
		<div role='img' aria-label={label} className='h-full w-full'>
			<ResponsiveRadar
				data={data}
				keys={[t.expenses]}
				indexBy='categoria'
				maxValue='auto'
				margin={{ top: 32, right: 64, bottom: 32, left: 64 }}
				curve='linearClosed'
				borderWidth={2}
				borderColor={{ from: 'color' }}
				gridLevels={5}
				gridShape='circular'
				gridLabelOffset={16}
				enableDots
				dotSize={8}
				dotColor={colors.surface}
				dotBorderWidth={2}
				dotBorderColor={{ from: 'color' }}
				enableDotLabel={false}
				colors={[colors.series[0]]}
				fillOpacity={0.25}
				blendMode='normal'
				isInteractive
				valueFormat={(value) => formatCurrency(Number(value), 'DOP')}
				theme={theme}
			/>
		</div>
	)
}

export default AnalysisRadarChart
