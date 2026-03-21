'use client'

import { ResponsiveLine } from '@nivo/line'

interface AnalysisLineChartProps {
	data: any[]
	theme: string | undefined
	nivoTheme: any
	t: {
		income: string
		expenses: string
		month: string
		amount: string
	}
}

const AnalysisLineChart = ({ data, theme, nivoTheme, t }: AnalysisLineChartProps) => {
	return (
		<ResponsiveLine
			data={data}
			theme={nivoTheme}
			margin={{ top: 30, right: 30, bottom: 60, left: 60 }}
			xScale={{ type: 'point' }}
			yScale={{ type: 'linear', min: 'auto', max: 'auto', stacked: false, reverse: false }}
			curve='catmullRom'
			axisBottom={{
				tickSize: 5,
				tickPadding: 5,
				tickRotation: 45,
				legend: t.month,
				legendOffset: 48,
				legendPosition: 'middle',
			}}
			axisLeft={{
				tickSize: 5,
				tickPadding: 5,
				tickRotation: 0,
				legend: t.amount,
				legendOffset: -50,
				legendPosition: 'middle',
			}}
			lineWidth={3}
			enableArea={true}
			areaOpacity={0.08}
			pointSize={8}
			pointColor={{ theme: 'background' }}
			pointBorderWidth={2}
			pointBorderColor={{ from: 'serieColor' }}
			enablePointLabel={false}
			useMesh={true}
			legends={[
				{
					anchor: 'bottom-right',
					direction: 'column',
					justify: false,
					translateX: 100,
					translateY: 0,
					itemsSpacing: 0,
					itemDirection: 'left-to-right',
					itemWidth: 80,
					itemHeight: 20,
					itemOpacity: 0.75,
					symbolSize: 12,
					symbolShape: 'circle',
					symbolBorderColor: 'rgba(0, 0, 0, .5)',
					itemTextColor: theme === 'dark' ? '#ffffff' : '#374151',
					effects: [{ on: 'hover', style: { itemBackground: 'rgba(0, 0, 0, .03)', itemOpacity: 1 } }],
				},
			]}
		/>
	)
}

export default AnalysisLineChart
