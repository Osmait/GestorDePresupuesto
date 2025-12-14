'use client'

import { useMemo, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useTheme } from 'next-themes'
import { ResponsiveLine } from '@nivo/line'
import { ResponsiveBar } from '@nivo/bar'
import { ResponsiveRadar } from '@nivo/radar'
import { ResponsiveHeatMap } from '@nivo/heatmap'
import { ResponsivePie } from '@nivo/pie'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useGetCategoryExpenses, useGetMonthlySummary } from '@/hooks/queries/useAnalyticsQuery'
import { useGetCategories } from '@/hooks/queries/useCategoriesQuery'
import { useGetAccounts } from '@/hooks/queries/useAccountsQuery'
import { useGetAllTransactions } from '@/hooks/queries/useTransactionsQuery'
import { AnalyticsSkeleton } from '@/components/skeletons/analytics-skeleton'
import { useAnalysisContext } from './AnalysisContext'

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
    const { filters } = useAnalysisContext()
    const { data: accounts = [], isLoading: accountsLoading } = useGetAccounts()
    const { data: categories = [], isLoading: categoriesLoading } = useGetCategories()
    const { data: transactions = [], isLoading: transactionsLoading } = useGetAllTransactions()

    // New TanStack Query Hooks
    const { data: categoryExpenses = [], isLoading: isLoadingCategoryExpenses } = useGetCategoryExpenses()
    const { data: monthlySummary = [], isLoading: isLoadingMonthlySummary } = useGetMonthlySummary()

    const nivoTheme = useMemo(() => ({
        background: 'transparent',
        textColor: theme === 'dark' ? '#e5e7eb' : '#374151',
    }), [theme])

    // ... (rest of the code)

    const loading = accountsLoading || categoriesLoading || transactionsLoading || isLoadingCategoryExpenses || isLoadingMonthlySummary

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
                    <CardTitle>Ingresos y Gastos por Mes</CardTitle>
                </CardHeader>
                <CardContent style={{ height: 300 }}>
                    <ResponsiveLine
                        data={monthlySummary && monthlySummary.length > 0 ? [
                            { id: 'Ingresos', color: theme === 'dark' ? '#22c55e' : '#16a34a', data: monthlySummary.map(m => ({ x: m.month, y: m.Ingresos })) },
                            { id: 'Gastos', color: theme === 'dark' ? '#ef4444' : '#dc2626', data: monthlySummary.map(m => ({ x: m.month, y: Math.abs(m.Gastos) })) }
                        ] : mockLine}
                        theme={nivoTheme} margin={{ top: 30, right: 30, bottom: 60, left: 60 }}
                        xScale={{ type: 'point' }} yScale={{ type: 'linear', min: 'auto', max: 'auto', stacked: false, reverse: false }}
                        axisBottom={{ tickSize: 5, tickPadding: 5, tickRotation: 45, legend: 'Mes', legendOffset: 48, legendPosition: 'middle' }}
                        axisLeft={{ tickSize: 5, tickPadding: 5, tickRotation: 0, legend: 'Monto', legendOffset: -50, legendPosition: 'middle' }}
                        pointSize={10} pointColor={{ theme: 'background' }} pointBorderWidth={2} pointBorderColor={{ from: 'serieColor' }} enablePointLabel={false} useMesh={true} legends={[{ anchor: 'bottom-right', direction: 'column', justify: false, translateX: 100, translateY: 0, itemsSpacing: 0, itemDirection: 'left-to-right', itemWidth: 80, itemHeight: 20, itemOpacity: 0.75, symbolSize: 12, symbolShape: 'circle', symbolBorderColor: 'rgba(0, 0, 0, .5)', itemTextColor: theme === 'dark' ? '#e5e7eb' : '#374151', effects: [{ on: 'hover', style: { itemBackground: 'rgba(0, 0, 0, .03)', itemOpacity: 1 } }] }]}
                    />
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Gastos por Categoría</CardTitle>
                </CardHeader>
                <CardContent style={{ height: 300 }}>
                    <ResponsiveBar
                        data={categoryExpenses && categoryExpenses.length > 0 ? categoryExpenses.map(cat => ({ categoria: cat.label, monto: Math.abs(cat.value) })) : mockBar}
                        keys={['monto']} indexBy='categoria' margin={{ top: 30, right: 30, bottom: 60, left: 60 }} padding={0.3} valueScale={{ type: 'linear' }} indexScale={{ type: 'band', round: true }}
                        colors={{ scheme: 'nivo' }} borderColor={{ from: 'color', modifiers: [['darker', 1.6]] }} axisTop={null} axisRight={null}
                        axisBottom={{ tickSize: 5, tickPadding: 5, tickRotation: 45, legend: 'Categoría', legendOffset: 48, legendPosition: 'middle' }}
                        axisLeft={{ tickSize: 5, tickPadding: 5, tickRotation: 0, legend: 'Monto', legendOffset: -50, legendPosition: 'middle' }}
                        labelSkipWidth={12} labelSkipHeight={12} labelTextColor={{ from: 'color', modifiers: [['darker', 1.6]] }} theme={nivoTheme}
                    />
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Distribución por Categoría</CardTitle>
                </CardHeader>
                <CardContent style={{ height: 300 }}>
                    <ResponsivePie
                        data={categoryExpenses && categoryExpenses.length > 0 ? categoryExpenses.map(cat => ({ id: cat.id, label: cat.label, value: Math.abs(cat.value), color: cat.color })) : mockPie}
                        margin={{ top: 30, right: 30, bottom: 50, left: 60 }} innerRadius={0.5} padAngle={0.7} cornerRadius={3} activeOuterRadiusOffset={8} borderWidth={1} borderColor={{ from: 'color', modifiers: [['darker', 0.2]] }}
                        arcLinkLabelsSkipAngle={10} arcLinkLabelsTextColor={theme === 'dark' ? '#e5e7eb' : '#333333'} arcLinkLabelsThickness={2} arcLinkLabelsColor={{ from: 'color' }}
                        arcLabelsSkipAngle={10} arcLabelsTextColor={{ from: 'color', modifiers: [['darker', 2]] }} theme={nivoTheme}
                    />
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Radar de Categorías</CardTitle>
                </CardHeader>
                <CardContent style={{ height: 300 }}>
                    <ResponsiveRadar data={categoryExpenses && categoryExpenses.length > 0 ? categoryExpenses.map(cat => ({ categoria: cat.label, Gastos: Math.abs(cat.value), Ingresos: 0 })) : mockRadar} keys={['Gastos', 'Ingresos']} indexBy='categoria' maxValue='auto' margin={{ top: 30, right: 30, bottom: 50, left: 60 }} curve='linearClosed' borderWidth={2} borderColor={{ from: 'color' }} gridLevels={5} gridShape='circular' gridLabelOffset={36} enableDots={true} dotSize={8} dotColor={{ theme: 'background' }} dotBorderWidth={2} dotBorderColor={{ from: 'color' }} enableDotLabel={true} dotLabel='value' dotLabelYOffset={-12} colors={{ scheme: 'nivo' }} fillOpacity={0.25} blendMode='multiply' animate={true} isInteractive={true} theme={nivoTheme} />
                </CardContent>
            </Card>

            <Card className='md:col-span-2'>
                <CardHeader>
                    <CardTitle>Mapa de Calor Semanal</CardTitle>
                </CardHeader>
                <CardContent style={{ height: 300 }}>
                    <ResponsiveHeatMap data={mockHeat} margin={{ top: 30, right: 30, bottom: 50, left: 60 }} forceSquare={true} axisTop={null} axisRight={null} axisBottom={{ tickSize: 5, tickPadding: 5, tickRotation: 0, legend: 'Mes', legendOffset: 36, legendPosition: 'middle' }} axisLeft={{ tickSize: 5, tickPadding: 5, tickRotation: 0, legend: 'Día', legendOffset: -50, legendPosition: 'middle' }} borderColor={{ from: 'color', modifiers: [['darker', 0.4]] }} labelTextColor={{ from: 'color', modifiers: [['darker', 1.8]] }} theme={nivoTheme} />
                </CardContent>
            </Card>
        </motion.div>
    )
}
