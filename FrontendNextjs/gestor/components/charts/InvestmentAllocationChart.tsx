'use client'

import { ResponsivePie } from '@nivo/pie'

export interface AllocationSlice {
	id: string
	label: string
	value: number
	color: string
}

interface InvestmentAllocationChartProps {
	data: AllocationSlice[]
	totalValue: number
	isDark: boolean
	nivoTheme: any
	formatValue: (_value: number) => string
}

export default function InvestmentAllocationChart({
	data,
	totalValue,
	isDark,
	nivoTheme,
	formatValue,
}: InvestmentAllocationChartProps) {
	return (
		<ResponsivePie
			data={data}
			margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
			innerRadius={0.6}
			padAngle={0.5}
			cornerRadius={3}
			activeOuterRadiusOffset={8}
			colors={{ datum: 'data.color' }}
			borderWidth={1}
			borderColor={{ from: 'color', modifiers: [['darker', 0.2]] }}
			enableArcLinkLabels={true}
			arcLinkLabelsSkipAngle={10}
			arcLinkLabelsTextColor={isDark ? '#ffffff' : '#333333'}
			arcLinkLabelsThickness={2}
			arcLinkLabelsColor={{ from: 'color' }}
			arcLabelsSkipAngle={10}
			arcLabelsTextColor={{ from: 'color', modifiers: [['darker', 2]] }}
			theme={nivoTheme}
			tooltip={({ datum }) => (
				<div
					style={{
						color: datum.color,
						background: isDark ? '#333' : '#fff',
						padding: '5px 10px',
						borderRadius: '4px',
					}}
				>
					<strong>{datum.label}</strong>: {formatValue(datum.value)} ({((datum.value / totalValue) * 100).toFixed(1)}%)
				</div>
			)}
		/>
	)
}
