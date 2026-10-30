'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Calculator, ChevronDown, ChevronUp } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import * as z from 'zod'
import { Amount } from '@/components/shared/Amount'
import { FormDialog } from '@/components/shared/FormDialog'
import { MoneyInput } from '@/components/shared/MoneyInput'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { moneyMessages, moneySchema } from '@/lib/money-input'
import { Certificate, InterestType } from '@/types/certificate'

// Only shown after a simulation runs: load the chart code on demand.
const SimulationLineChart = dynamic(() => import('@/components/charts/SimulationLineChart'), {
	ssr: false,
	loading: () => <Skeleton className='h-full w-full' />,
})

type Translator = (key: string, values?: Record<string, string | number>) => string

function createSimulatorSchema(t: Translator, tForms: Translator) {
	const amount = (required: string) => moneySchema(moneyMessages(tForms, { required }))
	const rate = (required: string) => moneySchema(moneyMessages(tForms, { required, number: true }))
	return z.object({
		capital: amount(t('errors.capitalMin')).pipe(z.number().min(0.01, t('errors.capitalMin'))),
		interestRate: rate(t('errors.rateRange')).pipe(
			z.number().min(0.01, t('errors.rateRange')).max(100, t('errors.rateRange')),
		),
		taxRate: rate(t('errors.taxRange')).pipe(z.number().min(0, t('errors.taxRange')).max(100, t('errors.taxRange'))),
		months: z.coerce.number<number>().min(1, t('errors.monthsRange')).max(120, t('errors.monthsRange')),
		interestType: z.enum(['simple', 'compound']),
		reinvestInterest: z.boolean(),
	})
}

type FormData = z.infer<ReturnType<typeof createSimulatorSchema>>

type FormInput = z.input<ReturnType<typeof createSimulatorSchema>>

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
	const tActions = useTranslations('common.actions')
	const tForms = useTranslations('forms')
	const simulatorSchema = useMemo(() => createSimulatorSchema(t, tForms), [t, tForms])
	const formatCurrency = useFormatCurrency()
	const currency = certificate?.currency || 'DOP'
	const [results, setResults] = useState<SimulationResult[]>([])
	const [showDetail, setShowDetail] = useState(false)

	const form = useForm<FormInput, unknown, FormData>({
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
	const { watch, reset } = form

	const interestType = watch('interestType')

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

	const numberFields = [
		{ name: 'capital', label: t('capital'), money: true },
		{ name: 'interestRate', label: t('interestRate'), money: true },
		{ name: 'taxRate', label: t('taxRate'), money: true },
		{ name: 'months', label: t('months'), money: false },
	] as const

	return (
		<FormDialog
			open={open}
			onOpenChange={onOpenChange}
			title={
				<span className='flex items-center gap-2'>
					<Calculator className='h-5 w-5 text-muted-foreground' aria-hidden='true' />
					{t('title')}
				</span>
			}
			size='lg'
			// A simulator saves nothing: "Close" instead of "Cancel".
			cancelLabel={tActions('close')}
			submitLabel={t('calculate')}
			onSubmit={form.handleSubmit(onFormSubmit)}
		>
			<Form {...form}>
				<div className='space-y-4'>
					<div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
						{numberFields.map((item) => (
							<FormField
								key={item.name}
								control={form.control}
								name={item.name}
								render={({ field }) => (
									<FormItem>
										<FormLabel>{item.label}</FormLabel>
										<FormControl>
											{item.money ? (
												<MoneyInput {...field} />
											) : (
												<Input type='number' step='1' inputMode='numeric' {...field} />
											)}
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						))}
					</div>

					<FormField
						control={form.control}
						name='interestType'
						render={({ field }) => (
							<FormItem>
								<FormLabel>{t('interestType')}</FormLabel>
								<Select value={field.value} onValueChange={(value: InterestType) => field.onChange(value)}>
									<FormControl>
										<SelectTrigger>
											<SelectValue />
										</SelectTrigger>
									</FormControl>
									<SelectContent>
										<SelectItem value='simple'>{tType('simple')}</SelectItem>
										<SelectItem value='compound'>{tType('compound')}</SelectItem>
									</SelectContent>
								</Select>
								<FormMessage />
							</FormItem>
						)}
					/>

					{showReinvestToggle && (
						<FormField
							control={form.control}
							name='reinvestInterest'
							render={({ field }) => (
								<FormItem className='flex items-center gap-2 space-y-0'>
									<FormControl>
										<Switch checked={field.value} onCheckedChange={field.onChange} />
									</FormControl>
									<FormLabel className='font-normal'>{t('reinvest')}</FormLabel>
								</FormItem>
							)}
						/>
					)}
				</div>
			</Form>

			{results.length > 0 && totals && (
				<div className='mt-4 space-y-4 border-t pt-4'>
					<dl className='grid grid-cols-1 gap-4 sm:grid-cols-3'>
						<div className='rounded-lg border p-3'>
							<dt className='text-xs text-muted-foreground'>{t('totalGross')}</dt>
							<dd className='text-lg font-semibold'>
								<Amount value={totals.totalGross} currency={currency} />
							</dd>
						</div>
						<div className='rounded-lg border p-3'>
							<dt className='text-xs text-muted-foreground'>{t('totalTax')}</dt>
							<dd className='text-lg font-semibold'>
								<Amount value={-totals.totalTax} currency={currency} tone='auto' />
							</dd>
						</div>
						<div className='rounded-lg border p-3'>
							<dt className='text-xs text-muted-foreground'>{t('totalNet')}</dt>
							<dd className='text-lg font-semibold'>
								<Amount value={totals.totalNet} currency={currency} tone='auto' />
							</dd>
						</div>
					</dl>

					<div className='rounded-lg border p-3'>
						<p className='mb-3 text-xs text-muted-foreground'>{t('monthlyEvolution')}</p>
						<div className='h-56 w-full'>
							<SimulationLineChart
								rows={chartData}
								labels={{
									capital: t('capitalSeries'),
									totalWithNet: t('capitalPlusNet'),
									month: (month) => t('monthLabel', { month: String(month) }),
									chart: t('chartAria', { months: results.length }),
								}}
								formatValue={(value) => formatCurrency(value, currency)}
							/>
						</div>
					</div>

					<Button
						type='button'
						variant='outline'
						size='sm'
						onClick={() => setShowDetail(!showDetail)}
						className='w-full'
						aria-expanded={showDetail}
					>
						{showDetail ? (
							<ChevronUp className='mr-2 h-4 w-4' aria-hidden='true' />
						) : (
							<ChevronDown className='mr-2 h-4 w-4' aria-hidden='true' />
						)}
						{showDetail ? t('hideDetail') : t('showDetail')}
					</Button>

					{showDetail && (
						<div className='overflow-x-auto rounded-lg border'>
							<Table className='min-w-[640px]'>
								<TableHeader>
									<TableRow>
										<TableHead className='whitespace-nowrap'>{t('month')}</TableHead>
										<TableHead className='whitespace-nowrap text-right'>{t('capitalSeries')}</TableHead>
										<TableHead className='whitespace-nowrap text-right'>{t('gross')}</TableHead>
										<TableHead className='whitespace-nowrap text-right'>{t('tax')}</TableHead>
										<TableHead className='whitespace-nowrap text-right'>{t('net')}</TableHead>
										<TableHead className='whitespace-nowrap text-right'>{t('accumulated')}</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{results.map((row) => (
										<TableRow key={row.month}>
											<TableCell className='tabular-nums'>{row.month}</TableCell>
											<TableCell className='text-right'>
												<Amount value={row.capital} currency={currency} />
											</TableCell>
											<TableCell className='text-right'>
												<Amount value={row.grossInterest} currency={currency} />
											</TableCell>
											<TableCell className='text-right'>
												<Amount value={-row.taxWithheld} currency={currency} tone='auto' />
											</TableCell>
											<TableCell className='text-right'>
												<Amount value={row.netInterest} currency={currency} tone='auto' />
											</TableCell>
											<TableCell className='text-right font-medium'>
												<Amount value={row.accumulatedNet} currency={currency} />
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</div>
					)}
				</div>
			)}
		</FormDialog>
	)
}
