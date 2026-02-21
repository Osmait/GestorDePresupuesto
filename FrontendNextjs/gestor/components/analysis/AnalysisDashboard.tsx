'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { useTheme } from 'next-themes'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useGetDashboardSummary } from '@/hooks/queries/useAnalyticsQuery'
import { AnalyticsSkeleton } from '@/components/skeletons/analytics-skeleton'
import { useTranslations } from 'next-intl'
import dynamic from 'next/dynamic'
import { useAnalysisContext } from './AnalysisContext'
import { TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import { AnalyticsQueryFilters } from '@/types/analytics'

const AnalysisLineChart = dynamic(() => import('@/components/charts/AnalysisLineChart'), { 
    ssr: false, 
    loading: () => <div className="h-full w-full bg-muted/20 animate-pulse rounded" /> 
})
const AnalysisBarChart = dynamic(() => import('@/components/charts/AnalysisBarChart'), { 
    ssr: false, 
    loading: () => <div className="h-full w-full bg-muted/20 animate-pulse rounded" /> 
})
const AnalysisPieChart = dynamic(() => import('@/components/charts/AnalysisPieChart'), { 
    ssr: false, 
    loading: () => <div className="h-full w-full bg-muted/20 animate-pulse rounded" /> 
})
const AnalysisRadarChart = dynamic(() => import('@/components/charts/AnalysisRadarChart'), { 
    ssr: false, 
    loading: () => <div className="h-full w-full bg-muted/20 animate-pulse rounded" /> 
})
const AnalysisHeatMap = dynamic(() => import('@/components/charts/AnalysisHeatMap'), { 
    ssr: false, 
    loading: () => <div className="h-full w-full bg-muted/20 animate-pulse rounded" /> 
})

const mockHeat = [
    {
        id: 'Lun',
        data: [
            { x: 'Ene', y: 2 },
            { x: 'Feb', y: 3 },
        ]
    },
]

export function AnalysisDashboard() {
	const { theme } = useTheme()
	const t = useTranslations('analysis')
    const { filters } = useAnalysisContext()
    const categoryPalette = ['#22c55e', '#0ea5e9', '#f59e0b', '#f97316', '#eab308', '#14b8a6', '#ef4444', '#8b5cf6']

    const formatDate = (date: Date) => date.toISOString().split('T')[0]

    const activeFilters = useMemo((): AnalyticsQueryFilters => {
        const next: AnalyticsQueryFilters = {}

        if (filters.filterMode === 'month') {
            const selectedYear = Number(filters.year || new Date().getFullYear())
            if (filters.month && filters.month !== 'all') {
                const selectedMonth = Number(filters.month)
                const from = new Date(selectedYear, selectedMonth - 1, 1)
                const to = new Date(selectedYear, selectedMonth, 0)
                next.date_from = formatDate(from)
                next.date_to = formatDate(to)
            } else {
                const from = new Date(selectedYear, 0, 1)
                const to = new Date(selectedYear, 11, 31)
                next.date_from = formatDate(from)
                next.date_to = formatDate(to)
            }
        } else if (filters.dateRange?.from && filters.dateRange?.to) {
            next.date_from = formatDate(filters.dateRange.from)
            next.date_to = formatDate(filters.dateRange.to)
        }

        if (filters.account !== 'all') next.account_id = filters.account
        if (filters.category !== 'all') next.category_id = filters.category
        if (filters.type === 'INCOME') next.type = 'income'
        if (filters.type === 'BILL') next.type = 'bill'

        return next
    }, [filters])

    const previousPeriodFilters = useMemo((): AnalyticsQueryFilters | undefined => {
        if (!activeFilters.date_from || !activeFilters.date_to) return undefined

        const from = new Date(`${activeFilters.date_from}T00:00:00`)
        const to = new Date(`${activeFilters.date_to}T00:00:00`)
        if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return undefined

        const diffMs = to.getTime() - from.getTime()
        const prevTo = new Date(from.getTime() - 24 * 60 * 60 * 1000)
        const prevFrom = new Date(prevTo.getTime() - diffMs)

        return {
            ...activeFilters,
            date_from: formatDate(prevFrom),
            date_to: formatDate(prevTo),
        }
    }, [activeFilters])

	// TanStack Query Hooks
	const { data: dashboardSummary, isLoading: isLoadingDashboardSummary } = useGetDashboardSummary(activeFilters)
	const { data: previousSummary } = useGetDashboardSummary(previousPeriodFilters)

    const categoryExpenses = dashboardSummary?.category_expenses || []
    const monthlySummary = dashboardSummary?.monthly_summary || []

    const nivoTheme = useMemo(() => ({
        background: 'transparent',
        text: {
            fill: theme === 'dark' ? '#ffffff' : '#333333',
            fontSize: 11,
        },
        axis: {
            domain: {
                line: {
                    stroke: theme === 'dark' ? '#525252' : '#e5e7eb',
                    strokeWidth: 1,
                },
            },
            legend: {
                text: {
                    fill: theme === 'dark' ? '#ffffff' : '#333333',
                    fontSize: 12,
                    fontWeight: 500,
                },
            },
            ticks: {
                line: {
                    stroke: theme === 'dark' ? '#525252' : '#e5e7eb',
                    strokeWidth: 1,
                },
                text: {
                    fill: theme === 'dark' ? '#ffffff' : '#333333',
                    fontSize: 11,
                },
            },
        },
        grid: {
            line: {
                stroke: theme === 'dark' ? '#444444' : '#e5e7eb',
                strokeWidth: 1,
            },
        },
        legends: {
            text: {
                fill: theme === 'dark' ? '#ffffff' : '#333333',
                fontSize: 11,
            },
        },
        tooltip: {
            container: {
                background: theme === 'dark' ? '#1f2937' : '#ffffff',
                color: theme === 'dark' ? '#ffffff' : '#333333',
                fontSize: 12,
                borderRadius: '6px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            },
        },
    }), [theme])

    // ... (rest of the code)

	const loading = isLoadingDashboardSummary

	if (loading) return <AnalyticsSkeleton />

    const totalIncome = dashboardSummary?.total_income || 0
    const totalExpenses = dashboardSummary?.total_expenses || 0
    const netAmount = dashboardSummary?.net_amount || 0
    const savingsRate = totalIncome > 0 ? (netAmount / totalIncome) * 100 : 0

    const selectedFrom = activeFilters.date_from ? new Date(`${activeFilters.date_from}T00:00:00`) : null
    const selectedTo = activeFilters.date_to ? new Date(`${activeFilters.date_to}T00:00:00`) : null
    const daysInRange = selectedFrom && selectedTo
        ? Math.max(1, Math.floor((selectedTo.getTime() - selectedFrom.getTime()) / (24 * 60 * 60 * 1000)) + 1)
        : 30

    const avgDailySpend = totalExpenses / daysInRange
    const previousExpenses = previousSummary?.total_expenses || 0
    const expenseDelta = previousExpenses > 0
        ? ((totalExpenses - previousExpenses) / previousExpenses) * 100
        : 0

    const topCategory = [...categoryExpenses].sort((a, b) => b.value - a.value)[0]
    const normalizeAmount = (value: number) => Math.round(Math.abs(value) * 100) / 100

    const formatDOP = (value: number) => new Intl.NumberFormat('es-DO', {
        style: 'currency',
        currency: 'DOP',
        maximumFractionDigits: 2,
    }).format(value)

	return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="space-y-6 mb-10"
        >
            <div className='grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4'>
                <Card>
                    <CardHeader className='pb-1'>
                        <CardTitle className='text-sm font-medium text-muted-foreground'>{t('income')}</CardTitle>
                    </CardHeader>
                    <CardContent className='pt-0'>
                        <p className='text-2xl font-semibold'>{formatDOP(totalIncome)}</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className='pb-1'>
                        <CardTitle className='text-sm font-medium text-muted-foreground'>{t('expense')}</CardTitle>
                    </CardHeader>
                    <CardContent className='pt-0'>
                        <div className='flex items-center gap-2'>
                            <p className='text-2xl font-semibold'>{formatDOP(totalExpenses)}</p>
                            {expenseDelta !== 0 && (
                                <span className={`text-xs font-medium ${expenseDelta > 0 ? 'text-destructive' : 'text-success'}`}>
                                    {expenseDelta > 0 ? '+' : ''}{expenseDelta.toFixed(1)}%
                                </span>
                            )}
                        </div>
                        <p className='text-xs text-muted-foreground'>vs periodo anterior</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className='pb-1'>
                        <CardTitle className='text-sm font-medium text-muted-foreground'>Savings Rate</CardTitle>
                    </CardHeader>
                    <CardContent className='pt-0'>
                        <div className='flex items-center gap-2'>
                            <p className='text-2xl font-semibold'>{savingsRate.toFixed(1)}%</p>
                            {savingsRate >= 20 ? <TrendingUp className='h-4 w-4 text-success' /> : <TrendingDown className='h-4 w-4 text-destructive' />}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className='pb-1'>
                        <CardTitle className='text-sm font-medium text-muted-foreground'>Daily Spend</CardTitle>
                    </CardHeader>
                    <CardContent className='pt-0'>
                        <div className='flex items-center gap-2'>
                            <Wallet className='h-4 w-4 text-muted-foreground' />
                            <p className='text-2xl font-semibold'>{formatDOP(avgDailySpend)}</p>
                        </div>
                        <p className='text-xs text-muted-foreground'>{daysInRange} días analizados</p>
                    </CardContent>
                </Card>
            </div>

            {topCategory && (
                <Card>
                    <CardContent className='pt-6'>
                        <p className='text-sm text-muted-foreground'>Top categoría del periodo</p>
                        <p className='text-lg font-semibold text-foreground'>{topCategory.label}</p>
                        <p className='text-sm text-muted-foreground'>
                            {formatDOP(topCategory.value)} · {topCategory.transaction_count} transacciones
                        </p>
                    </CardContent>
                </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <Card>
                <CardHeader>
                    <CardTitle>{t('incomeExpensesByMonth')}</CardTitle>
                </CardHeader>
                <CardContent style={{ height: 300 }}>
                    <AnalysisLineChart
                        data={monthlySummary && monthlySummary.length > 0 ? [
                            { id: t('income'), color: '#22c55e', data: monthlySummary.map(m => ({ x: m.month, y: m.Ingresos })) },
                            { id: t('expenses'), color: '#f97316', data: monthlySummary.map(m => ({ x: m.month, y: Math.abs(m.Gastos) })) }
                        ] : []}
                        theme={theme}
                        nivoTheme={nivoTheme}
                        t={{
                            income: t('income'),
                            expenses: t('expenses'),
                            month: t('month'),
                            amount: t('amount')
                        }}
                    />
                </CardContent>
            </Card>

                <Card>
                <CardHeader>
                    <CardTitle>{t('expensesByCategory')}</CardTitle>
                </CardHeader>
                <CardContent style={{ height: 300 }}>
                    <AnalysisBarChart
                        data={categoryExpenses && categoryExpenses.length > 0 ? categoryExpenses.map(cat => ({ categoria: cat.label, monto: normalizeAmount(cat.value) })) : []}
                        nivoTheme={nivoTheme}
                        t={{
                            category: t('category'),
                            amount: t('amount')
                        }}
                    />
                </CardContent>
            </Card>

                <Card>
                <CardHeader>
                    <CardTitle>{t('categoryDistribution')}</CardTitle>
                </CardHeader>
                <CardContent style={{ height: 300 }}>
                    <AnalysisPieChart
                        data={categoryExpenses && categoryExpenses.length > 0 ? categoryExpenses.map((cat, index) => ({ id: cat.label || cat.id, label: cat.label || cat.id, value: normalizeAmount(cat.value), color: cat.color || categoryPalette[index % categoryPalette.length] })) : []}
                        theme={theme}
                        nivoTheme={nivoTheme}
                    />
                </CardContent>
                </Card>

                <Card>
                <CardHeader>
                    <CardTitle>{t('categoryRadar')}</CardTitle>
                </CardHeader>
                <CardContent style={{ height: 300 }}>
                    <AnalysisRadarChart
                        data={categoryExpenses && categoryExpenses.length > 0 ? categoryExpenses.map(cat => ({ categoria: cat.label, [t('expenses')]: normalizeAmount(cat.value) })) : []}
                        nivoTheme={nivoTheme}
                        t={{
                            expenses: t('expenses'),
                        }}
                    />
                </CardContent>
            </Card>

            <Card className='md:col-span-2'>
                <CardHeader>
                    <CardTitle>{t('weeklyHeatmap')}</CardTitle>
                </CardHeader>
                <CardContent style={{ height: 300 }}>
                    <AnalysisHeatMap
                        data={mockHeat}
                        nivoTheme={nivoTheme}
                        t={{
                            month: t('month'),
                            day: t('day')
                        }}
                    />
                </CardContent>
            </Card>
            </div>
        </motion.div>
    )
}
