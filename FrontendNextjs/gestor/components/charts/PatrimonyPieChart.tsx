'use client'

import { ResponsivePie } from '@nivo/pie'

interface PatrimonyPieChartProps {
	data: { label: string; value: number; color: string }[]
	total: number
	formatValue: (_value: number) => string
}

export default function PatrimonyPieChart({ data, total, formatValue }: PatrimonyPieChartProps) {
	return (
		<ResponsivePie
			data={data}
			margin={{ top: 20, right: 20, bottom: 40, left: 20 }}
			innerRadius={0.5}
			padAngle={2}
			cornerRadius={4}
			activeOuterRadiusOffset={8}
			colors={{ datum: 'data.color' }}
			borderWidth={1}
			borderColor={{ from: 'color', modifiers: [['darker', 0.2]] }}
			enableArcLabels={true}
			arcLabel={(d) => formatValue(d.value as number)}
			arcLabelsSkipAngle={10}
			arcLabelsTextColor={{ from: 'color', modifiers: [['darker', 2]] }}
			legends={[
				{
					anchor: 'bottom',
					direction: 'row',
					justify: false,
					translateX: 0,
					translateY: 30,
					itemsSpacing: 0,
					itemWidth: 80,
					itemHeight: 18,
					itemTextColor: '#999',
					itemDirection: 'left-to-right',
					itemOpacity: 1,
					symbolSize: 12,
					symbolShape: 'circle',
				},
			]}
			tooltip={({ datum }) => (
				<div className='bg-background border rounded-md px-3 py-2 shadow-md'>
					<p className='text-xs font-medium'>{datum.label}</p>
					<p className='text-sm font-bold'>{formatValue(datum.value as number)}</p>
					<p className='text-xs text-muted-foreground'>
						{total > 0 ? (((datum.value as number) / total) * 100).toFixed(1) : 0}%
					</p>
				</div>
			)}
			theme={{
				legends: {
					text: {
						fill: 'hsl(var(--muted-foreground))',
						fontSize: 11,
					},
				},
			}}
		/>
	)
}
