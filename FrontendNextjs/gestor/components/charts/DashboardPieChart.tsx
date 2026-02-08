'use client'

import { ResponsivePie } from '@nivo/pie'

interface DashboardPieChartProps {
  data: any[]
  theme: string | undefined
  nivoTheme: any
  t: {
    noExpenses: string
    expensesHint: string
  }
}

const DashboardPieChart = ({ data, theme, nivoTheme, t }: DashboardPieChartProps) => {
  if (data.length === 0) {
     return (
        <div className="flex items-center justify-center h-full text-muted-foreground">
            <div className="text-center">
                <p className="text-lg mb-2">📊</p>
                <p>{t.noExpenses}</p>
                <p className="text-sm">{t.expensesHint}</p>
            </div>
        </div>
    )
  }

  return (
    <ResponsivePie
        data={data}
        margin={{ top: 30, right: 40, bottom: 40, left: 40 }}
        innerRadius={0.6}
        padAngle={2}
        cornerRadius={8}
        colors={(d: any) => d.data.color}
        borderWidth={0}
        enableArcLinkLabels={true}
        arcLinkLabelsTextColor={theme === 'dark' ? '#9ca3af' : '#4b5563'}
        arcLinkLabelsColor={{ from: 'color' }}
        activeOuterRadiusOffset={8}
        theme={nivoTheme}
    />
  )
}

export default DashboardPieChart
