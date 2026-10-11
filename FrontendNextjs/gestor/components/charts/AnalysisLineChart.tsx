'use client'

import { ResponsiveLine } from '@nivo/line'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { getIntlLocale, useAppLocale } from '@/lib/i18n/date-locale'
import { useChartTheme } from './chart-theme'

export interface AnalysisLineSeries {
	id: string
	data: { x: string; y: number }[]
}

interface AnalysisLineChartProps {
	/** `[income, expenses]`, in that order: they take the positive/negative colors. */
	data: AnalysisLineSeries[]
	/** Accessible name of the chart (role="img"). */
	label: string
	t: {
		income: string
		expenses: string
		month: string
		amount: string
	}
}

const AnalysisLineChart = ({ data, label, t }: AnalysisLineChartProps) => {
	const { theme, colors } = useChartTheme(11)
	const formatCurrency = useFormatCurrency()
	const compact = new Intl.NumberFormat(getIntlLocale(useAppLocale()), { notation: 'compact' })

	return (
		<div role='img' aria-label={label} className='h-full w-full'>
			<ResponsiveLine
				data={data}
				theme={theme}
				colors={[colors.positive, colors.negative]}
				margin={{ top: 36, right: 24, bottom: 56, left: 56 }}
				xScale={{ type: 'point' }}
				yScale={{ type: 'linear', min: 'auto', max: 'auto', stacked: false, reverse: false }}
				curve='monotoneX'
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
					format: (value) => compact.format(Number(value)),
					legend: t.amount,
					legendOffset: -48,
					legendPosition: 'middle',
				}}
				yFormat={(value) => formatCurrency(Number(value), 'DOP')}
				lineWidth={2}
				enableArea
				areaOpacity={0.08}
				pointSize={8}
				pointColor={colors.surface}
				pointBorderWidth={2}
				pointBorderColor={{ from: 'seriesColor' }}
				enablePointLabel={false}
				useMesh
				legends={[
					{
						anchor: 'top-left',
						direction: 'row',
						justify: false,
						translateX: 0,
						translateY: -32,
						itemsSpacing: 16,
						itemDirection: 'left-to-right',
						itemWidth: 96,
						itemHeight: 20,
						symbolSize: 10,
						symbolShape: 'circle',
					},
				]}
			/>
		</div>
	)
}

export default AnalysisLineChart
