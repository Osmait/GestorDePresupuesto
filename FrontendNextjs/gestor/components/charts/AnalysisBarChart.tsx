'use client'

import { ResponsiveBar } from '@nivo/bar'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { getIntlLocale, useAppLocale } from '@/lib/i18n/date-locale'
import { useChartTheme } from './chart-theme'

export interface AnalysisBarDatum {
	[key: string]: string | number
	categoria: string
	monto: number
}

interface AnalysisBarChartProps {
	data: AnalysisBarDatum[]
	/** Accessible name of the chart (role="img"). */
	label: string
	t: {
		category: string
		amount: string
	}
}

const AnalysisBarChart = ({ data, label, t }: AnalysisBarChartProps) => {
	const { theme, colors } = useChartTheme(11)
	const formatCurrency = useFormatCurrency()
	const compact = new Intl.NumberFormat(getIntlLocale(useAppLocale()), { notation: 'compact' })

	return (
		<div role='img' aria-label={label} className='h-full w-full'>
			<ResponsiveBar
				data={data}
				keys={['monto']}
				indexBy='categoria'
				margin={{ top: 24, right: 24, bottom: 64, left: 56 }}
				padding={0.3}
				valueScale={{ type: 'linear' }}
				indexScale={{ type: 'band', round: true }}
				// One series (spend per category): one color; the category is already the axis label.
				colors={[colors.series[0]]}
				borderRadius={2}
				axisTop={null}
				axisRight={null}
				axisBottom={{
					tickSize: 5,
					tickPadding: 5,
					tickRotation: 45,
					legend: t.category,
					legendOffset: 52,
					legendPosition: 'middle',
				}}
				axisLeft={{
					tickSize: 5,
					tickPadding: 5,
					tickRotation: 0,
					format: (value) => compact.format(Number(value)),
					legend: t.amount,
					legendOffset: -48,
					legendPosition: 'middle',
				}}
				enableLabel={false}
				valueFormat={(value) => formatCurrency(Number(value), 'DOP')}
				theme={theme}
			/>
		</div>
	)
}

export default AnalysisBarChart
