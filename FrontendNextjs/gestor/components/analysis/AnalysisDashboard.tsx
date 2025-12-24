'use client'

import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { useTheme } from 'next-themes'
import { ResponsiveLine } from '@nivo/line'
import { ResponsiveBar } from '@nivo/bar'
import { ResponsiveRadar } from '@nivo/radar'
import { ResponsiveHeatMap } from '@nivo/heatmap'
import { ResponsivePie } from '@nivo/pie'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useGetCategoryExpenses, useGetMonthlySummary } from '@/hooks/queries/useAnalyticsQuery'
import { AnalyticsSkeleton } from '@/components/skeletons/analytics-skeleton'
import { useTranslations } from 'next-intl'

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
                    <ResponsiveLine
                        data={monthlySummary && monthlySummary.length > 0 ? [
                            { id: t('income'), color: theme === 'dark' ? '#22c55e' : '#16a34a', data: monthlySummary.map(m => ({ x: m.month, y: m.Ingresos })) },
                            { id: t('expenses'), color: theme === 'dark' ? '#ef4444' : '#dc2626', data: monthlySummary.map(m => ({ x: m.month, y: Math.abs(m.Gastos) })) }
                        ] : mockLine}
                        theme={nivoTheme} margin={{ top: 30, right: 30, bottom: 60, left: 60 }}
                        xScale={{ type: 'point' }} yScale={{ type: 'linear', min: 'auto', max: 'auto', stacked: false, reverse: false }}
                        axisBottom={{ tickSize: 5, tickPadding: 5, tickRotation: 45, legend: t('month'), legendOffset: 48, legendPosition: 'middle' }}
                        axisLeft={{ tickSize: 5, tickPadding: 5, tickRotation: 0, legend: t('amount'), legendOffset: -50, legendPosition: 'middle' }}
                        pointSize={10} pointColor={{ theme: 'background' }} pointBorderWidth={2} pointBorderColor={{ from: 'serieColor' }} enablePointLabel={false} useMesh={true} legends={[{ anchor: 'bottom-right', direction: 'column', justify: false, translateX: 100, translateY: 0, itemsSpacing: 0, itemDirection: 'left-to-right', itemWidth: 80, itemHeight: 20, itemOpacity: 0.75, symbolSize: 12, symbolShape: 'circle', symbolBorderColor: 'rgba(0, 0, 0, .5)', itemTextColor: theme === 'dark' ? '#ffffff' : '#374151', effects: [{ on: 'hover', style: { itemBackground: 'rgba(0, 0, 0, .03)', itemOpacity: 1 } }] }]}
                    />
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>{t('expensesByCategory')}</CardTitle>
                </CardHeader>
                <CardContent style={{ height: 300 }}>
                    <ResponsiveBar
                        data={categoryExpenses && categoryExpenses.length > 0 ? categoryExpenses.map(cat => ({ categoria: cat.label, monto: Math.abs(cat.value) })) : mockBar}
                        keys={['monto']} indexBy='categoria' margin={{ top: 30, right: 30, bottom: 60, left: 60 }} padding={0.3} valueScale={{ type: 'linear' }} indexScale={{ type: 'band', round: true }}
                        colors={{ scheme: 'nivo' }} borderColor={{ from: 'color', modifiers: [['darker', 1.6]] }} axisTop={null} axisRight={null}
                        axisBottom={{ tickSize: 5, tickPadding: 5, tickRotation: 45, legend: t('category'), legendOffset: 48, legendPosition: 'middle' }}
                        axisLeft={{ tickSize: 5, tickPadding: 5, tickRotation: 0, legend: t('amount'), legendOffset: -50, legendPosition: 'middle' }}
                        labelSkipWidth={12} labelSkipHeight={12} labelTextColor={{ from: 'color', modifiers: [['darker', 1.6]] }} theme={nivoTheme}
                    />
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>{t('categoryDistribution')}</CardTitle>
                </CardHeader>
                <CardContent style={{ height: 300 }}>
                    <ResponsivePie
                        data={categoryExpenses && categoryExpenses.length > 0 ? categoryExpenses.map(cat => ({ id: cat.id, label: cat.label, value: Math.abs(cat.value), color: cat.color })) : mockPie}
                        margin={{ top: 30, right: 30, bottom: 50, left: 60 }} innerRadius={0.5} padAngle={0.7} cornerRadius={3} activeOuterRadiusOffset={8} borderWidth={1} borderColor={{ from: 'color', modifiers: [['darker', 0.2]] }}
                        arcLinkLabelsSkipAngle={10} arcLinkLabelsTextColor={theme === 'dark' ? '#ffffff' : '#333333'} arcLinkLabelsThickness={2} arcLinkLabelsColor={{ from: 'color' }}
                        arcLabelsSkipAngle={10} arcLabelsTextColor={{ from: 'color', modifiers: [['darker', 2]] }} theme={nivoTheme}
                    />
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>{t('categoryRadar')}</CardTitle>
                </CardHeader>
                <CardContent style={{ height: 300 }}>
                    <ResponsiveRadar data={categoryExpenses && categoryExpenses.length > 0 ? categoryExpenses.map(cat => ({ categoria: cat.label, [t('expenses')]: Math.abs(cat.value), [t('income')]: 0 })) : mockRadar} keys={[t('expenses'), t('income')]} indexBy='categoria' maxValue='auto' margin={{ top: 30, right: 30, bottom: 50, left: 60 }} curve='linearClosed' borderWidth={2} borderColor={{ from: 'color' }} gridLevels={5} gridShape='circular' gridLabelOffset={36} enableDots={true} dotSize={8} dotColor={{ theme: 'background' }} dotBorderWidth={2} dotBorderColor={{ from: 'color' }} enableDotLabel={true} dotLabel='value' dotLabelYOffset={-12} colors={{ scheme: 'nivo' }} fillOpacity={0.25} blendMode='multiply' animate={true} isInteractive={true} theme={nivoTheme} />
                </CardContent>
            </Card>

            <Card className='md:col-span-2'>
                <CardHeader>
                    <CardTitle>{t('weeklyHeatmap')}</CardTitle>
                </CardHeader>
                <CardContent style={{ height: 300 }}>
                    <ResponsiveHeatMap data={mockHeat} margin={{ top: 30, right: 30, bottom: 50, left: 60 }} forceSquare={true} axisTop={null} axisRight={null} axisBottom={{ tickSize: 5, tickPadding: 5, tickRotation: 0, legend: t('month'), legendOffset: 36, legendPosition: 'middle' }} axisLeft={{ tickSize: 5, tickPadding: 5, tickRotation: 0, legend: t('day'), legendOffset: -50, legendPosition: 'middle' }} borderColor={{ from: 'color', modifiers: [['darker', 0.4]] }} labelTextColor={{ from: 'color', modifiers: [['darker', 1.8]] }} theme={nivoTheme} />
                </CardContent>
            </Card>
        </motion.div>
    )
}
