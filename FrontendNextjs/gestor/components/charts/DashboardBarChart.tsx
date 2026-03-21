'use client'

import { ResponsiveBar } from '@nivo/bar'

interface DashboardBarChartProps {
	data: any[]
	keys: string[]
	theme: string | undefined
	nivoTheme: any
	monthAbbreviations: string[]
	t: {
		noTransactions: string
		statsHint: string
	}
}

const DashboardBarChart = ({ data, keys, theme, nivoTheme, monthAbbreviations, t }: DashboardBarChartProps) => {
	if (data.length === 0) {
		return (
			<div className='flex items-center justify-center h-full text-muted-foreground'>
				<div className='text-center'>
					<p className='text-lg mb-2'>📈</p>
					<p>{t.noTransactions}</p>
					<p className='text-sm'>{t.statsHint}</p>
				</div>
			</div>
		)
	}

	return (
		<ResponsiveBar
			data={data}
			keys={keys}
			indexBy='month'
			margin={{ top: 20, right: 20, bottom: 60, left: 60 }}
			padding={0.5}
			innerPadding={4}
			groupMode='grouped'
			colors={[theme === 'dark' ? '#10b981' : '#059669', theme === 'dark' ? '#f43f5e' : '#e11d48']}
			borderRadius={4}
			enableLabel={false}
			enableGridX={false}
			enableGridY={true}
			theme={{
				...nivoTheme,
				grid: {
					line: {
						stroke: theme === 'dark' ? '#374151' : '#e5e7eb',
						strokeWidth: 1,
						strokeDasharray: '4 4',
					},
				},
			}}
			axisBottom={{
				format: (v: string) => {
					const parts = v.split('-')
					if (parts.length < 2) return v
					const month = parts[1]
					const index = parseInt(month, 10) - 1
					if (index >= 0 && index < monthAbbreviations.length) {
						return monthAbbreviations[index]
					}
					return v
				},
				tickSize: 0,
				tickPadding: 16,
				legend: '',
			}}
			axisLeft={{
				tickSize: 0,
				tickPadding: 16,
				tickValues: 5,
				legend: '',
			}}
			legends={[
				{
					dataFrom: 'keys',
					anchor: 'bottom-right',
					direction: 'row',
					justify: false,
					translateY: 60,
					translateX: 0,
					itemWidth: 100,
					itemHeight: 20,
					itemsSpacing: 0,
					symbolSize: 20,
					symbolShape: 'circle',
					itemTextColor: theme === 'dark' ? '#9ca3af' : '#6b7280',
					effects: [
						{
							on: 'hover',
							style: {
								itemTextColor: theme === 'dark' ? '#ffffff' : '#000000',
							},
						},
					],
				},
			]}
		/>
	)
}

export default DashboardBarChart
