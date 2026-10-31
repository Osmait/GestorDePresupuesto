'use client'

import { ResponsivePie } from '@nivo/pie'
import { PieChart } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { EmptyState } from '@/components/shared/EmptyState'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { useFormatPercent } from '@/hooks/useFormatPercent'
import { readableCategoryColor } from '@/lib/category-color'
import { CHART_TOOLTIP_CLASS, useChartTheme } from './chart-theme'

interface DashboardPieChartProps {
	/** Category expenses in DOP; `color` is the category's (user-chosen) color. */
	data: any[]
	/** @deprecated Ignored: the chart reads its theme from `useChartTheme()`. */
	theme?: string | undefined
	/** @deprecated Ignored: the chart reads its theme from `useChartTheme()`. */
	nivoTheme?: unknown
	t: {
		noExpenses: string
		expensesHint: string
	}
}

/** Expenses by category: donut with the total in the middle plus a legend of the top six. */
const DashboardPieChart = ({ data: rawData, t }: DashboardPieChartProps) => {
	const { theme, isDark } = useChartTheme(12)
	const tCharts = useTranslations('charts')
	const formatCurrency = useFormatCurrency()
	const formatPercent = useFormatPercent()

	// User colors, adjusted (if needed) to stand out from the card in the current theme.
	const mode = isDark ? 'dark' : 'light'
	const data = rawData.map((item: any) => ({ ...item, color: readableCategoryColor(item.color, mode) }))

	if (data.length === 0) {
		return <EmptyState compact icon={PieChart} title={t.noExpenses} description={t.expensesHint} />
	}

	const total = data.reduce((sum: number, item: any) => sum + Number(item.value || 0), 0)
	const formatDOP = (value: number) => formatCurrency(value, 'DOP')
	const percentOf = (value: number) => (total > 0 ? (value / total) * 100 : 0)

	return (
		<div className='grid h-full grid-cols-1 items-stretch gap-4 md:grid-cols-[1.4fr_1fr]'>
			<div
				role='img'
				aria-label={`${tCharts('expensesByCategory')}. ${tCharts('total')}: ${formatDOP(total)}`}
				className='relative min-h-[240px] md:min-h-0'
			>
				<ResponsivePie
					data={data}
					margin={{ top: 14, right: 14, bottom: 14, left: 14 }}
					innerRadius={0.74}
					padAngle={1.8}
					cornerRadius={4}
					colors={(d: any) => d.data.color}
					borderWidth={0}
					enableArcLabels={false}
					enableArcLinkLabels={false}
					activeOuterRadiusOffset={8}
					theme={theme}
					tooltip={({ datum }: any) => {
						const value = Number(datum.value || 0)
						return (
							<div className={CHART_TOOLTIP_CLASS}>
								<p className='font-semibold text-foreground'>{datum.label || datum.id}</p>
								<p className='tabular-nums text-muted-foreground'>{formatDOP(value)}</p>
								<p className='text-xs tabular-nums text-muted-foreground'>{formatPercent(percentOf(value))}</p>
							</div>
						)
					}}
				/>

				<div className='pointer-events-none absolute inset-0 flex items-center justify-center' aria-hidden='true'>
					<div className='text-center'>
						<p className='text-xs text-muted-foreground'>{tCharts('total')}</p>
						<p className='text-sm font-semibold tabular-nums text-foreground md:text-base'>{formatDOP(total)}</p>
					</div>
				</div>
			</div>

			<ul className='space-y-2 overflow-y-auto'>
				{data.slice(0, 6).map((item: any) => {
					const value = Number(item.value || 0)
					return (
						<li key={item.id} className='flex items-center justify-between gap-2 text-xs md:text-sm'>
							<span className='flex min-w-0 items-center gap-2'>
								<span
									className='h-2.5 w-2.5 shrink-0 rounded-full'
									style={{ backgroundColor: item.color }}
									aria-hidden='true'
								/>
								<span className='truncate text-muted-foreground'>{item.label || item.id}</span>
							</span>
							<span className='shrink-0 text-right'>
								<span className='block tabular-nums text-foreground'>{formatPercent(percentOf(value))}</span>
								<span className='block text-xs tabular-nums text-muted-foreground'>{formatDOP(value)}</span>
							</span>
						</li>
					)
				})}
			</ul>
		</div>
	)
}

export default DashboardPieChart
