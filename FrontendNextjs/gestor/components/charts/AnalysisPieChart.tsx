'use client'

import { ResponsivePie } from '@nivo/pie'

interface AnalysisPieChartProps {
	data: any[]
	theme: string | undefined
	nivoTheme: any
}

const AnalysisPieChart = ({ data, theme, nivoTheme }: AnalysisPieChartProps) => {
	return (
		<ResponsivePie
			data={data}
			margin={{ top: 30, right: 30, bottom: 50, left: 60 }}
			innerRadius={0.5}
			padAngle={0.7}
			cornerRadius={3}
			activeOuterRadiusOffset={8}
			borderWidth={1}
			borderColor={{ from: 'color', modifiers: [['darker', 0.2]] }}
			arcLinkLabelsSkipAngle={10}
			arcLinkLabel={(d) => String(d.label)}
			arcLinkLabelsTextColor={theme === 'dark' ? '#ffffff' : '#333333'}
			arcLinkLabelsThickness={2}
			arcLinkLabelsColor={{ from: 'color' }}
			enableArcLabels={false}
			valueFormat={(value) =>
				new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', maximumFractionDigits: 0 }).format(
					Number(value),
				)
			}
			theme={nivoTheme}
		/>
	)
}

export default AnalysisPieChart
