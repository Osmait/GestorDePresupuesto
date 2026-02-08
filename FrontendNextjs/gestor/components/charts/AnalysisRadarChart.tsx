'use client'

import { ResponsiveRadar } from '@nivo/radar'

interface AnalysisRadarChartProps {
    data: any[]
    nivoTheme: any
    t: {
        expenses: string
        income: string
    }
}

const AnalysisRadarChart = ({ data, nivoTheme, t }: AnalysisRadarChartProps) => {
    return (
        <ResponsiveRadar 
            data={data} 
            keys={[t.expenses, t.income]} 
            indexBy='categoria' 
            maxValue='auto' 
            margin={{ top: 30, right: 30, bottom: 50, left: 60 }} 
            curve='linearClosed' 
            borderWidth={2} 
            borderColor={{ from: 'color' }} 
            gridLevels={5} 
            gridShape='circular' 
            gridLabelOffset={36} 
            enableDots={true} 
            dotSize={8} 
            dotColor={{ theme: 'background' }} 
            dotBorderWidth={2} 
            dotBorderColor={{ from: 'color' }} 
            enableDotLabel={true} 
            dotLabel='value' 
            dotLabelYOffset={-12} 
            colors={{ scheme: 'nivo' }} 
            fillOpacity={0.25} 
            blendMode='multiply' 
            animate={true} 
            isInteractive={true} 
            theme={nivoTheme} 
        />
    )
}

export default AnalysisRadarChart
