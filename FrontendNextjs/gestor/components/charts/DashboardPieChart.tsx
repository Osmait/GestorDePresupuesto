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

  const total = data.reduce((sum: number, item: any) => sum + Number(item.value || 0), 0)

  const formatDOP = (value: number) => new Intl.NumberFormat('es-DO', {
    style: 'currency',
    currency: 'DOP',
    maximumFractionDigits: 2,
  }).format(value)

  return (
    <div className="h-full grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-4 items-stretch">
      <div className="relative min-h-[240px] md:min-h-0 rounded-lg border border-border/60 bg-muted/10">
        <ResponsivePie
          data={data}
          margin={{ top: 14, right: 14, bottom: 14, left: 14 }}
          innerRadius={0.74}
          padAngle={1.8}
          cornerRadius={9}
          colors={(d: any) => d.data.color}
          borderWidth={0}
          enableArcLabels={false}
          enableArcLinkLabels={false}
          activeOuterRadiusOffset={8}
          theme={nivoTheme}
          tooltip={({ datum }: any) => {
            const value = Number(datum.value || 0)
            const percentage = total > 0 ? (value / total) * 100 : 0
            return (
              <div className="rounded-md border border-border bg-card px-3 py-2 text-sm shadow-md">
                <p className="font-semibold text-foreground">{datum.label || datum.id}</p>
                <p className="text-muted-foreground">{formatDOP(value)}</p>
                <p className="text-xs text-muted-foreground">{percentage.toFixed(1)}%</p>
              </div>
            )
          }}
        />

        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Total</p>
            <p className="text-sm md:text-base font-semibold text-foreground">{formatDOP(total)}</p>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border/60 bg-muted/10 p-3 overflow-y-auto">
        <div className="space-y-2">
          {data.slice(0, 6).map((item: any) => {
            const value = Number(item.value || 0)
            const percentage = total > 0 ? (value / total) * 100 : 0
            return (
              <div key={item.id} className="flex items-center justify-between gap-2 text-xs md:text-sm">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="truncate text-muted-foreground">{item.label || item.id}</span>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-foreground tabular-nums">{percentage.toFixed(1)}%</p>
                  <p className="text-[10px] md:text-xs text-muted-foreground tabular-nums">{formatDOP(value)}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default DashboardPieChart
