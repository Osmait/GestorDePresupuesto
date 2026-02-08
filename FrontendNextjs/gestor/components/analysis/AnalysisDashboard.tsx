'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { useTheme } from 'next-themes'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useGetCategoryExpenses, useGetMonthlySummary } from '@/hooks/queries/useAnalyticsQuery'
import { AnalyticsSkeleton } from '@/components/skeletons/analytics-skeleton'
import { useTranslations } from 'next-intl'
import dynamic from 'next/dynamic'

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

// Mocks
const mockLine = [
    { id: 'Saldo', color: '#3b82f6', data: [{ x: 'Ene', y: 1200 }, { x: 'Feb', y: 1500 }] },
]
const mockBar = [{ categoria: 'Alimentación', monto: 500 }]
const mockRadar = [{ categoria: 'Alimentación', Gastos: 500, Ingresos: 0 }]
const mockPie = [{ id: 'Cuenta 1', label: 'Cuenta 1', value: 1200, color: '#3b82f6' }]
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

    // TanStack Query Hooks
    const { data: categoryExpenses = [], isLoading: isLoadingCategoryExpenses } = useGetCategoryExpenses()
    const { data: monthlySummary = [], isLoading: isLoadingMonthlySummary } = useGetMonthlySummary()

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

    const loading = isLoadingCategoryExpenses || isLoadingMonthlySummary

    if (loading) return <AnalyticsSkeleton />

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10"
        >
            <Card>
                <CardHeader>
                    <CardTitle>{t('incomeExpensesByMonth')}</CardTitle>
                </CardHeader>
                <CardContent style={{ height: 300 }}>
                    <AnalysisLineChart
                        data={monthlySummary && monthlySummary.length > 0 ? [
                            { id: t('income'), color: theme === 'dark' ? '#22c55e' : '#16a34a', data: monthlySummary.map(m => ({ x: m.month, y: m.Ingresos })) },
                            { id: t('expenses'), color: theme === 'dark' ? '#ef4444' : '#dc2626', data: monthlySummary.map(m => ({ x: m.month, y: Math.abs(m.Gastos) })) }
                        ] : mockLine}
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
                        data={categoryExpenses && categoryExpenses.length > 0 ? categoryExpenses.map(cat => ({ categoria: cat.label, monto: Math.abs(cat.value) })) : mockBar}
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
                        data={categoryExpenses && categoryExpenses.length > 0 ? categoryExpenses.map(cat => ({ id: cat.id, label: cat.label, value: Math.abs(cat.value), color: cat.color })) : mockPie}
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
                        data={categoryExpenses && categoryExpenses.length > 0 ? categoryExpenses.map(cat => ({ categoria: cat.label, [t('expenses')]: Math.abs(cat.value), [t('income')]: 0 })) : mockRadar}
                        nivoTheme={nivoTheme}
                        t={{
                            expenses: t('expenses'),
                            income: t('income')
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
        </motion.div>
    )
}
