'use client'

import { useTheme } from 'next-themes'
import { useMemo } from 'react'
import { CategoryExpense, MonthlySummary } from '@/types/analytics'
import { useTranslations } from 'next-intl'
import dynamic from 'next/dynamic'

const DashboardPieChart = dynamic(() => import('@/components/charts/DashboardPieChart'), { 
    ssr: false, 
    loading: () => <div className="h-full w-full bg-muted/20 animate-pulse rounded" /> 
})
const DashboardBarChart = dynamic(() => import('@/components/charts/DashboardBarChart'), { 
    ssr: false, 
    loading: () => <div className="h-full w-full bg-muted/20 animate-pulse rounded" /> 
})

interface DashboardChartsProps {
	categories: { id: string, name: string, color: string }[]
	transactions: { amount: number, type_transation: string, category_id: string, created_at: string }[]
	categorysData: CategoryExpense[]
	monthSummary: MonthlySummary[]
}

export function DashboardCharts({ categorysData, monthSummary }: DashboardChartsProps) {
	const { theme } = useTheme()
	const t = useTranslations('charts')



	const truncate = (str: string, n: number) => str.length > n ? str.slice(0, n) : str

	const pieData = categorysData ? categorysData.map(cat => {
		return {
			...cat,
			id: truncate(cat.label || cat.id, 12),
			originalId: cat.id,
			originalLabel: cat.label,
			value: Math.abs(cat.value),
		}
	}) : []

	// Transform data to use translated keys
	const barData = monthSummary ? monthSummary.map(month => {
		return {
			month: month.month,
			[t('income')]: month.Ingresos,
			[t('expenses')]: Math.abs(month.Gastos),
		}
	}) : []

	const nivoTheme = useMemo(() => ({
		background: 'transparent',
		textColor: theme === 'dark' ? '#e5e7eb' : '#374151',
		fontSize: 14,
		axis: {
			legend: { text: { fill: theme === 'dark' ? '#e5e7eb' : '#374151' } },
			ticks: { text: { fill: theme === 'dark' ? '#e5e7eb' : '#374151' } }
		},
		legends: {
			text: {
				fill: theme === 'dark' ? '#e5e7eb' : '#374151',
				fontSize: 13,
				fontWeight: 500
			}
		},
		tooltip: {
			container: {
				background: theme === 'dark' ? '#1f2937' : '#ffffff',
				color: theme === 'dark' ? '#e5e7eb' : '#374151',
				fontSize: 14,
				borderRadius: '8px',
				border: `1px solid ${theme === 'dark' ? '#374151' : '#d1d5db'}`,
				boxShadow: theme === 'dark'
					? '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.1)'
					: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
			},
			basic: {
				whiteSpace: 'pre',
				display: 'flex',
				alignItems: 'center'
			},
			table: {},
			tableCell: {
				padding: '3px 5px'
			}
		}
	}), [theme])

	const monthAbbreviations = [
		t('jan'), t('feb'), t('mar'), t('apr'), t('may'), t('jun'),
		t('jul'), t('aug'), t('sep'), t('oct'), t('nov'), t('dec')
	]

	return (
		<div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
			<div className="bg-card rounded-xl border border-border/50 p-4 flex flex-col items-center">
				<h3 className="font-semibold mb-2 text-lg text-foreground">{t('expensesByCategory')}</h3>
				<div className="h-64 w-full">
                    <DashboardPieChart 
                        data={pieData}
                        theme={theme}
                        nivoTheme={nivoTheme}
                        t={{
                            noExpenses: t('noExpenses'),
                            expensesHint: t('expensesHint')
                        }}
                    />
				</div>
			</div>
			<div className="bg-card rounded-xl border border-border/50 p-4 flex flex-col items-center">
				<h3 className="font-semibold mb-2 text-lg text-foreground">{t('incomeVsExpenses')}</h3>
				<div className="h-64 w-full">
                    <DashboardBarChart 
                        data={barData}
                        keys={[t('income'), t('expenses')]}
                        theme={theme}
                        nivoTheme={nivoTheme}
                        monthAbbreviations={monthAbbreviations}
                        t={{
                            noTransactions: t('noTransactions'),
                            statsHint: t('statsHint')
                        }}
                    />
				</div>
			</div>
		</div>
	)
}

