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
    return (
        <ResponsiveBar
            data={data}
            keys={['monto']} indexBy='categoria' margin={{ top: 30, right: 30, bottom: 60, left: 60 }} padding={0.3} valueScale={{ type: 'linear' }} indexScale={{ type: 'band', round: true }}
            colors={{ scheme: 'nivo' }} borderColor={{ from: 'color', modifiers: [['darker', 1.6]] }} axisTop={null} axisRight={null}
            axisBottom={{ tickSize: 5, tickPadding: 5, tickRotation: 45, legend: t.category, legendOffset: 48, legendPosition: 'middle' }}
            axisLeft={{ tickSize: 5, tickPadding: 5, tickRotation: 0, legend: t.amount, legendOffset: -50, legendPosition: 'middle' }}
            labelSkipWidth={12} labelSkipHeight={12} labelTextColor={{ from: 'color', modifiers: [['darker', 1.6]] }} theme={nivoTheme}
        />
    )
}

export default AnalysisBarChart
