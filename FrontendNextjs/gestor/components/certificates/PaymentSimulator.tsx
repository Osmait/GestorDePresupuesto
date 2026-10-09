'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Calculator, ChevronDown, ChevronUp } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import * as z from 'zod'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useAppLocale } from '@/lib/i18n/date-locale'
import { formatCurrency } from '@/lib/utils'
import { Certificate, InterestType } from '@/types/certificate'

function createSimulatorSchema(t: (key: string) => string) {
	return z.object({
		capital: z.coerce.number().min(0.01, t('errors.capitalMin')),
		interestRate: z.coerce.number().min(0.01, t('errors.rateRange')).max(100, t('errors.rateRange')),
		taxRate: z.coerce.number().min(0, t('errors.taxRange')).max(100, t('errors.taxRange')),
		months: z.coerce.number().min(1, t('errors.monthsRange')).max(120, t('errors.monthsRange')),
		interestType: z.enum(['simple', 'compound']),
		reinvestInterest: z.boolean(),
	})
}

type FormData = z.infer<ReturnType<typeof createSimulatorSchema>>

interface SimulationResult {
	month: number
	capital: number
	grossInterest: number
	taxWithheld: number
	netInterest: number
	accumulatedNet: number
}

interface PaymentSimulatorProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	certificate?: Certificate | null
}

export function PaymentSimulator({ open, onOpenChange, certificate }: PaymentSimulatorProps) {
	const t = useTranslations('certificates.simulator')
	const tType = useTranslations('certificates.interestType')
	const simulatorSchema = useMemo(() => createSimulatorSchema(t), [t])
	const locale = useAppLocale()
	const currency = certificate?.currency || 'DOP'
	const money = (value: number) => formatCurrency(value, currency, { locale })
	const [results, setResults] = useState<SimulationResult[]>([])
	const [showDetail, setShowDetail] = useState(false)

	const {
		register,
		handleSubmit,
		setValue,
		watch,
		reset,
		formState: { errors },
	} = useForm<FormData>({
		resolver: zodResolver(simulatorSchema),
		defaultValues: {
			capital: 100000,
			interestRate: 5,
			taxRate: 10,
			months: 12,
			interestType: 'simple',
			reinvestInterest: false,
		},
	})

	const interestType = watch('interestType')
	const reinvestInterest = watch('reinvestInterest')

	useEffect(() => {
		if (certificate) {
			reset({
				capital: certificate.base_capital,
				interestRate: certificate.current_interest_rate,
				taxRate: certificate.current_tax_rate,
				months: 12,
				interestType: certificate.interest_type,
				reinvestInterest: certificate.reinvest_interest,
			})
			setResults([])
		} else {
			reset({
				capital: 100000,
				interestRate: 5,
				taxRate: 10,
				months: 12,
				interestType: 'simple',
				reinvestInterest: false,
			})
			setResults([])
		}
	}, [certificate, reset])

	const showReinvestToggle = interestType === 'compound'

	const calculateSimulation = (data: FormData): SimulationResult[] => {
		const results: SimulationResult[] = []
		let currentCapital = data.capital
		let accumulatedNet = 0

		for (let month = 1; month <= data.months; month++) {
			const grossInterest = (currentCapital * (data.interestRate / 100)) / 12
			const taxWithheld = grossInterest * (data.taxRate / 100)
			const netInterest = grossInterest - taxWithheld

			accumulatedNet += netInterest

			results.push({
				month,
				capital: Math.round(currentCapital * 100) / 100,
				grossInterest: Math.round(grossInterest * 100) / 100,
				taxWithheld: Math.round(taxWithheld * 100) / 100,
				netInterest: Math.round(netInterest * 100) / 100,
				accumulatedNet: Math.round(accumulatedNet * 100) / 100,
			})

			if (data.interestType === 'compound' && data.reinvestInterest) {
				currentCapital += netInterest
			}
		}

		return results
	}

	const onFormSubmit = (data: FormData) => {
		const simulationResults = calculateSimulation(data)
		setResults(simulationResults)
	}

	const totals =
		results.length > 0
			? {
					totalGross: results[results.length - 1].accumulatedNet + results.reduce((sum, r) => sum + r.taxWithheld, 0),
					totalTax: results.reduce((sum, r) => sum + r.taxWithheld, 0),
					totalNet: results[results.length - 1].accumulatedNet,
				}
			: null

	const chartData =
		results.length > 0
			? results.map((row) => ({
					...row,
					totalWithNet: row.capital + row.accumulatedNet,
				}))
			: []

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className='w-[95vw] sm:max-w-[900px] max-h-[90vh] overflow-y-auto'>
				<DialogHeader>
					<DialogTitle className='flex items-center gap-2'>
						<Calculator className='h-5 w-5' />
						{t('title')}
					</DialogTitle>
				</DialogHeader>

				<form onSubmit={handleSubmit(onFormSubmit)} className='space-y-4'>
					<div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
						<div className='space-y-2'>
							<Label htmlFor='capital'>{t('capital')}</Label>
							<Input id='capital' type='number' step='0.01' {...register('capital')} />
							{errors.capital && <p className='text-sm text-red-500'>{errors.capital.message}</p>}
						</div>

						<div className='space-y-2'>
							<Label htmlFor='interestRate'>{t('interestRate')}</Label>
							<Input id='interestRate' type='number' step='0.01' {...register('interestRate')} />
							{errors.interestRate && <p className='text-sm text-red-500'>{errors.interestRate.message}</p>}
						</div>

						<div className='space-y-2'>
							<Label htmlFor='taxRate'>{t('taxRate')}</Label>
							<Input id='taxRate' type='number' step='0.01' {...register('taxRate')} />
							{errors.taxRate && <p className='text-sm text-red-500'>{errors.taxRate.message}</p>}
						</div>

						<div className='space-y-2'>
							<Label htmlFor='months'>{t('months')}</Label>
							<Input id='months' type='number' min={1} max={120} {...register('months')} />
							{errors.months && <p className='text-sm text-red-500'>{errors.months.message}</p>}
						</div>
					</div>

					<div className='space-y-2'>
						<Label>{t('interestType')}</Label>
						<Select value={interestType} onValueChange={(value: InterestType) => setValue('interestType', value)}>
							<SelectTrigger>
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value='simple'>{tType('simple')}</SelectItem>
								<SelectItem value='compound'>{tType('compound')}</SelectItem>
							</SelectContent>
						</Select>
					</div>

					{showReinvestToggle && (
						<div className='flex items-center gap-2'>
							<Switch
								id='reinvestInterest'
								checked={reinvestInterest}
								onCheckedChange={(checked) => setValue('reinvestInterest', checked)}
							/>
							<Label htmlFor='reinvestInterest' className='font-normal'>
								{t('reinvest')}
							</Label>
						</div>
					)}

					<Button type='submit' className='w-full'>
						<Calculator className='h-4 w-4 mr-2' />
						{t('calculate')}
					</Button>
				</form>

				{results.length > 0 && totals && (
					<div className='space-y-4 mt-4 pt-4 border-t'>
						<div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
							<div className='p-3 rounded-lg bg-muted'>
								<p className='text-xs text-muted-foreground'>{t('totalGross')}</p>
								<p className='text-lg font-semibold'>{money(totals.totalGross)}</p>
							</div>
							<div className='p-3 rounded-lg bg-orange-500/10'>
								<p className='text-xs text-muted-foreground'>{t('totalTax')}</p>
								<p className='text-lg font-semibold text-orange-500'>{money(totals.totalTax)}</p>
							</div>
							<div className='p-3 rounded-lg bg-green-500/10'>
								<p className='text-xs text-muted-foreground'>{t('totalNet')}</p>
								<p className='text-lg font-semibold text-green-500'>{money(totals.totalNet)}</p>
							</div>
						</div>

						<div className='rounded-lg border p-3'>
							<p className='mb-3 text-xs text-muted-foreground'>{t('monthlyEvolution')}</p>
							<div className='h-56 w-full'>
								<ResponsiveContainer width='100%' height='100%'>
									<LineChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
										<CartesianGrid strokeDasharray='3 3' vertical={false} className='stroke-border' />
										<XAxis
											dataKey='month'
											tickLine={false}
											axisLine={false}
											tick={{ fontSize: 11, fill: 'currentColor' }}
										/>
										<YAxis
											tickLine={false}
											axisLine={false}
											tick={{ fontSize: 11, fill: 'currentColor' }}
											tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`}
										/>
										<Tooltip
											contentStyle={{
												borderRadius: '8px',
												border: '1px solid hsl(var(--border))',
												background: 'hsl(var(--card))',
											}}
											formatter={(value: number | string | undefined, name: string | undefined) => {
												const numericValue = typeof value === 'number' ? value : Number(value || 0)
												if (name === 'capital') return [money(numericValue), t('capitalSeries')]
												if (name === 'totalWithNet') return [money(numericValue), t('capitalPlusNet')]
												return [String(value ?? ''), name || '']
											}}
											labelFormatter={(label) => t('monthLabel', { month: String(label) })}
										/>
										<Line
											type='monotone'
											dataKey='capital'
											stroke='hsl(var(--success))'
											strokeWidth={2}
											dot={false}
											name='capital'
										/>
										<Line
											type='monotone'
											dataKey='totalWithNet'
											stroke='hsl(var(--primary))'
											strokeWidth={2}
											dot={false}
											name='totalWithNet'
										/>
									</LineChart>
								</ResponsiveContainer>
							</div>
						</div>

						<Button variant='outline' size='sm' onClick={() => setShowDetail(!showDetail)} className='w-full'>
							{showDetail ? (
								<>
									<ChevronUp className='h-4 w-4 mr-2' />
									{t('hideDetail')}
								</>
							) : (
								<>
									<ChevronDown className='h-4 w-4 mr-2' />
									{t('showDetail')}
								</>
							)}
						</Button>

						{showDetail && (
							<div className='rounded-lg border overflow-hidden'>
								<div className='w-full max-w-full overflow-x-auto'>
									<table className='w-full min-w-[640px] table-auto text-sm'>
										<thead className='bg-muted'>
											<tr>
												<th className='px-3 py-2 text-left whitespace-nowrap'>{t('month')}</th>
												<th className='px-3 py-2 text-right whitespace-nowrap'>{t('capitalSeries')}</th>
												<th className='px-3 py-2 text-right whitespace-nowrap'>{t('gross')}</th>
												<th className='px-3 py-2 text-right whitespace-nowrap'>{t('tax')}</th>
												<th className='px-3 py-2 text-right whitespace-nowrap'>{t('net')}</th>
												<th className='px-3 py-2 text-right whitespace-nowrap'>{t('accumulated')}</th>
											</tr>
										</thead>
										<tbody>
											{results.map((row) => (
												<tr key={row.month} className='border-t'>
													<td className='px-3 py-2 whitespace-nowrap'>{row.month}</td>
													<td className='px-3 py-2 text-right whitespace-nowrap'>{money(row.capital)}</td>
													<td className='px-3 py-2 text-right whitespace-nowrap'>{money(row.grossInterest)}</td>
													<td className='px-3 py-2 text-right text-orange-500 whitespace-nowrap'>
														-{money(row.taxWithheld)}
													</td>
													<td className='px-3 py-2 text-right text-green-500 whitespace-nowrap'>
														{money(row.netInterest)}
													</td>
													<td className='px-3 py-2 text-right font-medium whitespace-nowrap'>
														{money(row.accumulatedNet)}
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							</div>
						)}
					</div>
				)}
			</DialogContent>
		</Dialog>
	)
}
