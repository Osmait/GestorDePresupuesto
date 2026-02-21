'use client'

import { ResponsiveBar } from '@nivo/bar'

interface AnalysisBarChartProps {
    data: any[]
    nivoTheme: any
    t: {
        category: string
        amount: string
    }
}

const AnalysisBarChart = ({ data, nivoTheme, t }: AnalysisBarChartProps) => {
    const palette = ['#0ea5e9', '#14b8a6', '#22c55e', '#f59e0b', '#f97316', '#ef4444', '#8b5cf6']

    return (
        <ResponsiveBar
            data={data}
            keys={['monto']} indexBy='categoria' margin={{ top: 30, right: 30, bottom: 60, left: 60 }} padding={0.3} valueScale={{ type: 'linear' }} indexScale={{ type: 'band', round: true }}
            colors={bar => palette[bar.index % palette.length]} borderColor={{ from: 'color', modifiers: [['darker', 1.1]] }} axisTop={null} axisRight={null}
            axisBottom={{ tickSize: 5, tickPadding: 5, tickRotation: 45, legend: t.category, legendOffset: 48, legendPosition: 'middle' }}
            axisLeft={{ tickSize: 5, tickPadding: 5, tickRotation: 0, legend: t.amount, legendOffset: -50, legendPosition: 'middle' }}
            labelSkipWidth={12} labelSkipHeight={12} labelTextColor={{ from: 'color', modifiers: [['darker', 1.4]] }}
            valueFormat={value => new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', maximumFractionDigits: 0 }).format(Number(value))}
            theme={nivoTheme}
        />
    )
}

export default AnalysisBarChart
