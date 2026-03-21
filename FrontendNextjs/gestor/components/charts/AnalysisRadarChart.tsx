'use client'

import { ResponsiveRadar } from '@nivo/radar'

interface AnalysisRadarChartProps {
	data: any[]
	nivoTheme: any
	t: {
		expenses: string
	}
}

const AnalysisRadarChart = ({ data, nivoTheme, t }: AnalysisRadarChartProps) => {
	return (
		<ResponsiveRadar
			data={data}
			keys={[t.expenses]}
			indexBy='categoria'
			maxValue='auto'
			margin={{ top: 30, right: 30, bottom: 50, left: 60 }}
			curve='linearClosed'
			borderWidth={2}
			borderColor={{ from: 'color' }}
			gridLevels={5}
			gridShape='circular'
			gridLabelOffset={18}
			enableDots={true}
			dotSize={8}
			dotColor={{ theme: 'background' }}
			dotBorderWidth={2}
			dotBorderColor={{ from: 'color' }}
			enableDotLabel={false}
			colors={['#f97316']}
			fillOpacity={0.35}
			blendMode='multiply'
			animate={true}
			isInteractive={true}
			valueFormat={(value) =>
				new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', maximumFractionDigits: 0 }).format(
					Number(value),
				)
			}
			theme={nivoTheme}
		/>
	)
}

export default AnalysisRadarChart
