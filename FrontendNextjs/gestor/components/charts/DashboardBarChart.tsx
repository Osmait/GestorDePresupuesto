'use client'

import { ResponsiveBar } from '@nivo/bar'
import { BarChart3 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/shared/EmptyState'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { CHART_TOOLTIP_CLASS, useChartTheme } from './chart-theme'

interface DashboardBarChartProps {
	data: any[]
	/** Series keys in order: income first, expenses second. */
	keys: string[]
	/** @deprecated Ignored: the chart reads its theme from `useChartTheme()`. */
	theme?: string | undefined
	/** @deprecated Ignored: the chart reads its theme from `useChartTheme()`. */
	nivoTheme?: unknown
	monthAbbreviations: string[]
	t: {
		noTransactions: string
		statsHint: string
	}
}

function monthLabel(value: string, monthAbbreviations: string[]) {
	const parts = String(value).split('-')
	if (parts.length < 2) return value
	const index = Number.parseInt(parts[1], 10) - 1
	return index >= 0 && index < monthAbbreviations.length ? monthAbbreviations[index] : value
}

/** Income vs expenses per month (DOP), income in the success color and expenses in the destructive one. */
const DashboardBarChart = ({ data, keys, monthAbbreviations, t }: DashboardBarChartProps) => {
	const { theme, colors } = useChartTheme(12)
	const tCharts = useTranslations('charts')
	const formatCurrency = useFormatCurrency()

	if (data.length === 0) {
		return <EmptyState compact icon={BarChart3} title={t.noTransactions} description={t.statsHint} />
	}

	return (
		<div role='img' aria-label={tCharts('incomeVsExpenses')} className='h-full w-full'>
			<ResponsiveBar
				data={data}
				keys={keys}
				indexBy='month'
				margin={{ top: 20, right: 20, bottom: 60, left: 72 }}
				padding={0.5}
				innerPadding={4}
				groupMode='grouped'
				colors={[colors.positive, colors.negative]}
				borderRadius={4}
				enableLabel={false}
				enableGridX={false}
				enableGridY={true}
				theme={theme}
				valueFormat={(value) => formatCurrency(Number(value), 'DOP')}
				axisBottom={{
					format: (value: string) => monthLabel(value, monthAbbreviations),
					tickSize: 0,
					tickPadding: 16,
					legend: '',
				}}
				axisLeft={{
					tickSize: 0,
					tickPadding: 12,
					tickValues: 5,
					legend: '',
					format: (value) => formatCurrency(Number(value), 'DOP', { maximumFractionDigits: 0 }),
				}}
				tooltip={({ id, value, indexValue, color }) => (
					<div className={CHART_TOOLTIP_CLASS}>
						<p className='mb-1 font-semibold'>{monthLabel(String(indexValue), monthAbbreviations)}</p>
						<p className='flex items-center gap-2 tabular-nums'>
							<span className='h-2.5 w-2.5 rounded-full' style={{ backgroundColor: color }} aria-hidden='true' />
							{id}: {formatCurrency(Number(value), 'DOP')}
						</p>
					</div>
				)}
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
						symbolSize: 12,
						symbolShape: 'circle',
						itemTextColor: colors.mutedText,
						effects: [{ on: 'hover', style: { itemTextColor: colors.text } }],
					},
				]}
			/>
		</div>
	)
}

export default DashboardBarChart
