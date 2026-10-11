'use client'

import dynamic from 'next/dynamic'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { CategoryExpense, MonthlySummary } from '@/types/analytics'

// Both charts take their Nivo theme and colors from useChartTheme() (resolvedTheme + CSS tokens).
const DashboardPieChart = dynamic(() => import('@/components/charts/DashboardPieChart'), {
	ssr: false,
	loading: () => <Skeleton className='h-full w-full' />,
})
const DashboardBarChart = dynamic(() => import('@/components/charts/DashboardBarChart'), {
	ssr: false,
	loading: () => <Skeleton className='h-full w-full' />,
})

interface DashboardChartsProps {
	categories: { id: string; name: string; color: string }[]
	categorysData: CategoryExpense[]
	monthSummary: MonthlySummary[]
}

export function DashboardCharts({ categorysData, monthSummary }: DashboardChartsProps) {
	const t = useTranslations('charts')

	const pieData = categorysData
		? [...categorysData]
				.map((cat) => ({
					...cat,
					id: cat.id,
					label: cat.label || cat.id,
					value: Math.abs(cat.value),
				}))
				.filter((cat) => cat.value > 0)
				.sort((a, b) => b.value - a.value)
		: []

	// Series keys are the translated labels (they show in the legend and tooltip).
	const barData = monthSummary
		? monthSummary.map((month) => ({
				month: month.month,
				[t('income')]: month.Ingresos,
				[t('expenses')]: Math.abs(month.Gastos),
			}))
		: []

	const monthAbbreviations = [
		t('jan'),
		t('feb'),
		t('mar'),
		t('apr'),
		t('may'),
		t('jun'),
		t('jul'),
		t('aug'),
		t('sep'),
		t('oct'),
		t('nov'),
		t('dec'),
	]

	return (
		<div className='grid grid-cols-1 gap-4 lg:grid-cols-2'>
			<Card>
				<CardHeader className='pb-2'>
					<CardTitle className='text-base font-semibold'>{t('expensesByCategory')}</CardTitle>
				</CardHeader>
				<CardContent>
					<div className='h-[320px] w-full'>
						<DashboardPieChart
							data={pieData}
							t={{
								noExpenses: t('noExpenses'),
								expensesHint: t('expensesHint'),
							}}
						/>
					</div>
				</CardContent>
			</Card>
			<Card>
				<CardHeader className='pb-2'>
					<CardTitle className='text-base font-semibold'>{t('incomeVsExpenses')}</CardTitle>
				</CardHeader>
				<CardContent>
					<div className='h-[320px] w-full'>
						<DashboardBarChart
							data={barData}
							keys={[t('income'), t('expenses')]}
							monthAbbreviations={monthAbbreviations}
							t={{
								noTransactions: t('noTransactions'),
								statsHint: t('statsHint'),
							}}
						/>
					</div>
				</CardContent>
			</Card>
		</div>
	)
}
