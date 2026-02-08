'use client'

import { ResponsiveHeatMap } from '@nivo/heatmap'

interface AnalysisHeatMapProps {
    data: any[]
    nivoTheme: any
    t: {
        month: string
        day: string
    }
}

const AnalysisHeatMap = ({ data, nivoTheme, t }: AnalysisHeatMapProps) => {
    return (
        <ResponsiveHeatMap 
            data={data} 
            margin={{ top: 30, right: 30, bottom: 50, left: 60 }} 
            forceSquare={true} 
            axisTop={null} 
            axisRight={null} 
            axisBottom={{ tickSize: 5, tickPadding: 5, tickRotation: 0, legend: t.month, legendOffset: 36, legendPosition: 'middle' }} 
            axisLeft={{ tickSize: 5, tickPadding: 5, tickRotation: 0, legend: t.day, legendOffset: -50, legendPosition: 'middle' }} 
            borderColor={{ from: 'color', modifiers: [['darker', 0.4]] }} 
            labelTextColor={{ from: 'color', modifiers: [['darker', 1.8]] }} 
            theme={nivoTheme} 
        />
    )
}

export default AnalysisHeatMap
