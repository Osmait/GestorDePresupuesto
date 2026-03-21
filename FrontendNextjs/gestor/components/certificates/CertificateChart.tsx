'use client'

import { ResponsiveLine } from '@nivo/line'
import { useMemo, useState } from 'react'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Certificate, CertificatePayment, formatCurrency } from '@/types/certificate'

interface ChartDataPoint {
	x: string
	y: number
	isProjection: boolean
}

interface CertificateChartProps {
	certificate: Certificate
	payments: CertificatePayment[]
}

const PROJECTION_OPTIONS = [
	{ value: '6', label: '6 meses' },
	{ value: '12', label: '12 meses' },
	{ value: 'maturity', label: 'Hasta vencimiento' },
]

function addMonths(date: Date, months: number): Date {
	const result = new Date(date)
	result.setMonth(result.getMonth() + months)
	return result
}

function formatDate(date: Date): string {
	return date.toLocaleDateString('es-DO', { month: 'short', year: '2-digit' })
}

function getMonthsUntilMaturity(maturityDate: string | undefined): number {
	if (!maturityDate) return 12
	const maturity = new Date(maturityDate)
	const now = new Date()
	const months = (maturity.getFullYear() - now.getFullYear()) * 12 + (maturity.getMonth() - now.getMonth())
	return Math.max(1, Math.min(months, 60))
}

export function CertificateChart({ certificate, payments }: CertificateChartProps) {
	const [projectionMonths, setProjectionMonths] = useState<string>('12')
	const [showCapitalBase, setShowCapitalBase] = useState(true)

	const monthsToShow = useMemo(() => {
		if (projectionMonths === 'maturity') {
			return getMonthsUntilMaturity(certificate.maturity_date)
		}
		return parseInt(projectionMonths, 10)
	}, [projectionMonths, certificate.maturity_date])

	const chartData = useMemo(() => {
		const data: { totalValue: ChartDataPoint[]; capitalBase: ChartDataPoint[] } = {
			totalValue: [],
			capitalBase: [],
		}

		let accumulatedNet = 0
		let currentCapital = certificate.base_capital

		const historicalPayments = [...payments].reverse()

		historicalPayments.forEach((payment) => {
			accumulatedNet += payment.net_interest
			data.totalValue.push({
				x: formatDate(new Date(payment.payment_date)),
				y: certificate.base_capital + accumulatedNet,
				isProjection: false,
			})
			data.capitalBase.push({
				x: formatDate(new Date(payment.payment_date)),
				y: certificate.base_capital,
				isProjection: false,
			})
			if (certificate.interest_type === 'compound' && certificate.reinvest_interest) {
				currentCapital = payment.applied_capital + payment.net_interest
			}
		})

		const lastPaymentDate =
			historicalPayments.length > 0
				? new Date(historicalPayments[historicalPayments.length - 1].payment_date)
				: new Date(certificate.created_at)

		for (let i = 1; i <= monthsToShow; i++) {
			const grossInterest = (currentCapital * (certificate.current_interest_rate / 100)) / 12
			const taxWithheld = grossInterest * (certificate.current_tax_rate / 100)
			const netInterest = grossInterest - taxWithheld

			accumulatedNet += netInterest

			const projectionDate = addMonths(lastPaymentDate, i)

			data.totalValue.push({
				x: formatDate(projectionDate),
				y: certificate.base_capital + accumulatedNet,
				isProjection: true,
			})
			data.capitalBase.push({
				x: formatDate(projectionDate),
				y: certificate.base_capital,
				isProjection: true,
			})

			if (certificate.interest_type === 'compound' && certificate.reinvest_interest) {
				currentCapital += netInterest
			}
		}

		return data
	}, [certificate, payments, monthsToShow])

	const nivoData = [
		{
			id: 'Valor Total',
			data: chartData.totalValue,
			color: 'hsl(142, 76%, 36%)',
		},
		...(showCapitalBase
			? [
					{
						id: 'Capital Base',
						data: chartData.capitalBase,
						color: 'hsl(215, 16%, 47%)',
					},
				]
			: []),
	]

	return (
		<div className='space-y-4'>
			<div className='flex flex-wrap items-center justify-between gap-4'>
				<div className='flex items-center gap-4'>
					<div className='flex items-center gap-2'>
						<Label htmlFor='projection' className='text-sm'>
							Proyección:
						</Label>
						<Select value={projectionMonths} onValueChange={setProjectionMonths}>
							<SelectTrigger className='w-[160px]'>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{PROJECTION_OPTIONS.map((opt) => (
									<SelectItem key={opt.value} value={opt.value}>
										{opt.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</div>
				<div className='flex items-center gap-2'>
					<Switch id='showCapitalBase' checked={showCapitalBase} onCheckedChange={setShowCapitalBase} />
					<Label htmlFor='showCapitalBase' className='text-sm font-normal'>
						Mostrar Capital Base
					</Label>
				</div>
			</div>

			<div className='h-[300px] w-full'>
				<ResponsiveLine
					data={nivoData}
					margin={{ top: 20, right: 30, bottom: 50, left: 70 }}
					xScale={{ type: 'point' }}
					yScale={{
						type: 'linear',
						min: 'auto',
						max: 'auto',
					}}
					axisBottom={{
						tickSize: 5,
						tickPadding: 5,
						tickRotation: -45,
					}}
					axisLeft={{
						tickSize: 5,
						tickPadding: 5,
						tickRotation: 0,
						format: (value) => formatCurrency(value),
					}}
					enablePoints={true}
					pointSize={6}
					pointColor={{ from: 'color' }}
					pointBorderWidth={2}
					pointBorderColor={{ from: 'serieColor' }}
					pointLabel={(d) => formatCurrency(d.y)}
					useMesh={true}
					colors={{ datum: 'color' }}
					legends={[
						{
							anchor: 'top-right',
							direction: 'row',
							justify: false,
							translateX: 0,
							translateY: -10,
							itemsSpacing: 0,
							itemDirection: 'left-to-right',
							itemWidth: 100,
							itemHeight: 20,
							itemOpacity: 0.75,
							symbolSize: 12,
							symbolShape: 'circle',
							symbolBorderColor: 'rgba(0, 0, 0, .5)',
						},
					]}
					tooltip={({ point }) => (
						<div className='bg-background border rounded-md px-3 py-2 shadow-md'>
							<p className='text-xs text-muted-foreground'>{point.data.xFormatted}</p>
							<p className='text-sm font-semibold'>{formatCurrency(point.data.y as number)}</p>
						</div>
					)}
					theme={{
						axis: {
							ticks: {
								text: {
									fill: 'hsl(var(--muted-foreground))',
									fontSize: 11,
								},
							},
						},
						grid: {
							line: {
								stroke: 'hsl(var(--border))',
								strokeWidth: 1,
							},
						},
					}}
				/>
			</div>

			<div className='flex justify-center gap-6 text-xs text-muted-foreground'>
				<div className='flex items-center gap-2'>
					<div className='w-8 h-0.5 bg-green-600' />
					<span>Valor Total (Capital + Intereses)</span>
				</div>
				{showCapitalBase && (
					<div className='flex items-center gap-2'>
						<div className='w-8 h-0.5 border-t-2 border-dashed border-slate-400' />
						<span>Capital Base</span>
					</div>
				)}
			</div>
		</div>
	)
}
