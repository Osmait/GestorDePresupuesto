'use client'

import { ResponsiveLine } from '@nivo/line'
import { ResponsiveBar } from '@nivo/bar'
import { ResponsiveRadar } from '@nivo/radar'
import { ResponsiveHeatMap } from '@nivo/heatmap'
import { ResponsivePie } from '@nivo/pie'
import { useTheme } from 'next-themes'
import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'

// Datos mock para ejemplo visual
const mockLine = [
  {
    id: 'Saldo',
    color: 'hsl(210, 70%, 50%)',
    data: [
      { x: 'Ene', y: 1200 },
      { x: 'Feb', y: 1500 },
      { x: 'Mar', y: 1100 },
      { x: 'Abr', y: 1800 },
      { x: 'May', y: 1700 },
      { x: 'Jun', y: 2100 },
    ]
  },
  {
    id: 'Ingresos',
    color: 'hsl(140, 70%, 50%)',
    data: [
      { x: 'Ene', y: 2000 },
      { x: 'Feb', y: 2200 },
      { x: 'Mar', y: 1800 },
      { x: 'Abr', y: 2500 },
      { x: 'May', y: 2300 },
      { x: 'Jun', y: 2700 },
    ]
  },
  {
    id: 'Gastos',
    color: 'hsl(0, 70%, 50%)',
    data: [
      { x: 'Ene', y: 800 },
      { x: 'Feb', y: 700 },
      { x: 'Mar', y: 900 },
      { x: 'Abr', y: 700 },
      { x: 'May', y: 600 },
      { x: 'Jun', y: 900 },
    ]
  }
]

const mockBar = [
  { categoria: 'Alimentación', monto: 500 },
  { categoria: 'Transporte', monto: 300 },
  { categoria: 'Entretenimiento', monto: 200 },
  { categoria: 'Salud', monto: 150 },
  { categoria: 'Educación', monto: 100 },
]

const mockRadar = [
  { categoria: 'Alimentación', Gastos: 500, Ingresos: 0 },
  { categoria: 'Transporte', Gastos: 300, Ingresos: 0 },
  { categoria: 'Entretenimiento', Gastos: 200, Ingresos: 0 },
  { categoria: 'Salud', Gastos: 150, Ingresos: 0 },
  { categoria: 'Educación', Gastos: 100, Ingresos: 0 },
]

const mockHeat = [
  {
    id: 'Lun',
    data: [
      { x: 'Ene', y: 2 },
      { x: 'Feb', y: 3 },
      { x: 'Mar', y: 1 },
      { x: 'Abr', y: 4 },
      { x: 'May', y: 2 },
      { x: 'Jun', y: 3 },
    ]
  },
  {
    id: 'Mar',
    data: [
      { x: 'Ene', y: 1 },
      { x: 'Feb', y: 2 },
      { x: 'Mar', y: 2 },
      { x: 'Abr', y: 3 },
      { x: 'May', y: 1 },
      { x: 'Jun', y: 2 },
    ]
  },
  {
    id: 'Mié',
    data: [
      { x: 'Ene', y: 3 },
      { x: 'Feb', y: 1 },
      { x: 'Mar', y: 2 },
      { x: 'Abr', y: 2 },
      { x: 'May', y: 3 },
      { x: 'Jun', y: 1 },
    ]
  },
  {
    id: 'Jue',
    data: [
      { x: 'Ene', y: 2 },
      { x: 'Feb', y: 2 },
      { x: 'Mar', y: 3 },
      { x: 'Abr', y: 1 },
      { x: 'May', y: 2 },
      { x: 'Jun', y: 2 },
    ]
  },
  {
    id: 'Vie',
    data: [
      { x: 'Ene', y: 1 },
      { x: 'Feb', y: 3 },
      { x: 'Mar', y: 2 },
      { x: 'Abr', y: 2 },
      { x: 'May', y: 1 },
      { x: 'Jun', y: 3 },
    ]
  },
  {
    id: 'Sáb',
    data: [
      { x: 'Ene', y: 2 },
      { x: 'Feb', y: 1 },
      { x: 'Mar', y: 3 },
      { x: 'Abr', y: 3 },
      { x: 'May', y: 2 },
      { x: 'Jun', y: 1 },
    ]
  },
  {
    id: 'Dom',
    data: [
      { x: 'Ene', y: 3 },
      { x: 'Feb', y: 2 },
      { x: 'Mar', y: 1 },
      { x: 'Abr', y: 2 },
      { x: 'May', y: 3 },
      { x: 'Jun', y: 2 },
    ]
  },
]

const mockPie = [
  { id: 'Cuenta 1', label: 'Cuenta 1', value: 1200, color: '#2563eb' },
  { id: 'Cuenta 2', label: 'Cuenta 2', value: 800, color: '#f59e42' },
  { id: 'Cuenta 3', label: 'Cuenta 3', value: 600, color: '#34d399' },
]

export default function AnalysisPage() {
  const { theme } = useTheme()
  const [selectedBar, setSelectedBar] = useState<string | null>(null)
  const [selectedPie, setSelectedPie] = useState<string | null>(null)
  const [selectedLine, setSelectedLine] = useState<{ serieId: string, pointIndex: number } | null>(null)
  const nivoTheme = useMemo(() => ({
    background: 'transparent',
    textColor: theme === 'dark' ? '#e5e7eb' : '#222',
    fontSize: 14,
    axis: {
      legend: { text: { fill: theme === 'dark' ? '#e5e7eb' : '#222' } },
      ticks: { text: { fill: theme === 'dark' ? '#e5e7eb' : '#222' } }
    },
    legends: { text: { fill: theme === 'dark' ? '#e5e7eb' : '#222' } },
    tooltip: {
      container: {
        background: theme === 'dark' ? '#222' : '#fff',
        color: theme === 'dark' ? '#e5e7eb' : '#222',
        borderRadius: 8,
        boxShadow: '0 2px 12px 0 rgba(0,0,0,0.15)',
        fontWeight: 500,
        fontSize: 15,
        padding: '12px 16px',
      },
    },
  }), [theme])

  // Leyenda visual personalizada
  const legendWrapperStyle = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    marginTop: '32px',
    marginBottom: '8px',
    padding: '10px 0',
    background: theme === 'dark' ? 'rgba(30, 41, 59, 0.85)' : 'rgba(243, 244, 246, 0.85)',
    borderRadius: '12px',
    border: `1.5px solid ${theme === 'dark' ? '#334155' : '#e5e7eb'}`,
    boxShadow: '0 2px 8px 0 rgba(0,0,0,0.07)',
    overflowX: 'auto' as const,
    maxWidth: '100%',
    animation: 'fadeInLegend 0.7s',
  }
  // Animación fade-in para leyenda
  const legendFadeIn = `@keyframes fadeInLegend { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: none; } }`
  // Estilo para el texto de la leyenda
  const legendTextStyle = {
    fontSize: '1.15rem',
    fontWeight: 600,
    letterSpacing: '0.01em',
    margin: '0 18px',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    transition: 'color 0.2s',
  }
  const legendSymbolSize = 18
  const legendItemStyle = {
    itemTextColor: theme === 'dark' ? '#fbbf24' : '#1e293b',
    itemBackground: 'transparent',
    symbolSize: legendSymbolSize,
    itemWidth: 110,
    itemHeight: 32,
    itemsSpacing: 14,
    direction: 'row' as const,
    translateY: 60,
    symbolShape: 'circle' as const,
    effects: [
      {
        on: 'hover' as const,
        style: {
          itemTextColor: theme === 'dark' ? '#f59e42' : '#f87171',
          itemBackground: theme === 'dark' ? '#222' : '#f3f4f6',
          cursor: 'pointer',
        },
      },
    ],
  }

  return (
    <>
      <style>{legendFadeIn}</style>
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 dark:from-background dark:via-background dark:to-muted/20">
        <div className="container mx-auto px-4 py-8">
          <h1 className="text-4xl font-bold mb-8 bg-gradient-to-r from-foreground via-primary to-primary bg-clip-text text-transparent">Análisis Financiero Avanzado</h1>
          {/* Filtros y controles */}
          <div className="mb-8 flex flex-wrap gap-4 items-center">
            {/* Aquí irán selectores de fecha, cuentas, categorías, etc. */}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
            <Card>
              <CardHeader>
                <CardTitle>Evolución de Saldo, Ingresos y Gastos</CardTitle>
              </CardHeader>
              <CardContent className="h-[380px]">
                <ResponsiveLine
                  data={mockLine}
                  margin={{ top: 30, right: 30, bottom: 50, left: 60 }}
                  xScale={{ type: 'point' }}
                  yScale={{ type: 'linear', min: 'auto', max: 'auto', stacked: false, reverse: false }}
                  axisBottom={{ legend: 'Mes', legendOffset: 40, legendPosition: 'middle' }}
                  axisLeft={{ legend: 'Monto', legendOffset: -50, legendPosition: 'middle' }}
                  colors={d => d.id === (selectedLine?.serieId ?? '') ? '#f59e42' : d.color}
                  pointSize={12}
                  pointColor={{ theme: 'background' }}
                  pointBorderWidth={3}
                  pointBorderColor={d => d.seriesId === (selectedLine?.serieId ?? '') ? '#f59e42' : d.seriesColor}
                  enableSlices="x"
                  useMesh={true}
                  theme={nivoTheme}
                  animate={true}
                  motionConfig="wobbly"
                  legends={[]}
                  tooltip={({ point }) => (
                    <div>
                      <div className="font-bold text-lg mb-1">{('seriesId' in point ? point.seriesId : '')}</div>
                      <div>Mes: <b>{point.data.xFormatted}</b></div>
                      <div>Monto: <b>{point.data.yFormatted}</b></div>
                    </div>
                  )}
                  onClick={point => {
                    if ('seriesId' in point && 'index' in point) {
                      setSelectedLine({ serieId: point.seriesId, pointIndex: point.index })
                    }
                  }}
                />
                </CardContent>
              <CardFooter>
                <div style={legendWrapperStyle}>
                  {mockLine.map(line => (
                    <span key={line.id} style={legendTextStyle}>
                      <span style={{ display: 'inline-block', width: legendSymbolSize, height: legendSymbolSize, borderRadius: '50%', background: line.color, marginRight: 8, verticalAlign: 'middle' }} />
                      {line.id}
                    </span>
                  ))}
                </div>
              </CardFooter>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Top Categorías de Gasto</CardTitle>
              </CardHeader>
              <CardContent className="h-[380px]">
                <ResponsiveBar
                  data={mockBar}
                  keys={['monto']}
                  indexBy="categoria"
                  margin={{ top: 30, right: 30, bottom: 50, left: 60 }}
                  padding={0.3}
                  layout="horizontal"
                  colors={bar => bar.data.categoria === selectedBar ? '#f59e42' : (theme === 'dark' ? '#f87171' : '#2563eb')}
                  borderRadius={6}
                  enableLabel={true}
                  theme={nivoTheme}
                  animate={true}
                  motionConfig="wobbly"
                  axisBottom={{ legend: 'Monto', legendPosition: 'middle', legendOffset: 40 }}
                  axisLeft={{ legend: 'Categoría', legendPosition: 'middle', legendOffset: -50 }}
                  tooltip={({ id, value, indexValue }) => (
                    <div>
                      <div className="font-bold text-lg mb-1">{indexValue}</div>
                      <div>Monto: <b>{value}</b></div>
                    </div>
                  )}
                  onClick={bar => setSelectedBar(bar.data.categoria)}
                  legends={[]}
                />
                </CardContent>
              <CardFooter>
                <div style={legendWrapperStyle}>
                  <span style={legendTextStyle}>
                    <span style={{ display: 'inline-block', width: legendSymbolSize, height: legendSymbolSize, borderRadius: '50%', background: theme === 'dark' ? '#f87171' : '#2563eb', marginRight: 8, verticalAlign: 'middle' }} />
                    Monto
                  </span>
                </div>
              </CardFooter>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Distribución de Gastos por Categoría (Radar)</CardTitle>
              </CardHeader>
              <CardContent className="h-[380px]">
                <ResponsiveRadar
                  data={mockRadar}
                  keys={['Gastos', 'Ingresos']}
                  indexBy="categoria"
                  margin={{ top: 30, right: 30, bottom: 50, left: 60 }}
                  borderWidth={2}
                  borderColor={{ from: 'color' }}
                  gridLabelOffset={36}
                  dotSize={10}
                  dotColor={{ theme: 'background' }}
                  dotBorderWidth={3}
                  colors={{ scheme: 'nivo' }}
                  blendMode="multiply"
                  theme={nivoTheme}
                  animate={true}
                  motionConfig="wobbly"
                  legends={[]}
                />
                </CardContent>
              <CardFooter>
                <div style={legendWrapperStyle}>
                  <span style={legendTextStyle}>
                    <span style={{ display: 'inline-block', width: legendSymbolSize, height: legendSymbolSize, borderRadius: '50%', background: '#e8c1a0', marginRight: 8, verticalAlign: 'middle' }} />
                    Gastos
                  </span>
                  <span style={legendTextStyle}>
                    <span style={{ display: 'inline-block', width: legendSymbolSize, height: legendSymbolSize, borderRadius: '50%', background: '#f47560', marginRight: 8, verticalAlign: 'middle' }} />
                    Ingresos
                  </span>
                </div>
              </CardFooter>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Actividad por Día y Mes (Heatmap)</CardTitle>
              </CardHeader>
              <CardContent className="h-[380px]">
                <ResponsiveHeatMap
                  data={mockHeat}
                  margin={{ top: 30, right: 30, bottom: 50, left: 60 }}
                  valueFormat={v => `${v}`}
                  axisTop={null}
                  axisRight={null}
                  axisBottom={{ legend: 'Mes', legendPosition: 'middle', legendOffset: 40 }}
                  axisLeft={{ legend: 'Día', legendPosition: 'middle', legendOffset: -50 }}
                  theme={nivoTheme}
                  borderColor={{ from: 'color', modifiers: [['darker', 0.4]] }}
                  labelTextColor={{ from: 'color', modifiers: [['darker', 1.8]] }}
                  colors={{ type: 'quantize', scheme: 'blues' }}
                  animate={true}
                  motionConfig="wobbly"
                  legends={[]}
                  tooltip={({ cell }) => (
                    <div>
                      <div className="font-bold text-lg mb-1">{cell.serieId} - {cell.data.x}</div>
                      <div>Actividad: <b>{typeof cell.data.y === 'number' ? cell.data.y : '-'}</b></div>
                    </div>
                  )}
                />
                </CardContent>
              <CardFooter>
                <div style={legendWrapperStyle}>
                  <span style={legendTextStyle}>
                    <span style={{ display: 'inline-block', width: legendSymbolSize, height: legendSymbolSize, borderRadius: '50%', background: '#60a5fa', marginRight: 8, verticalAlign: 'middle' }} />
                    Actividad
                  </span>
                </div>
              </CardFooter>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Proporción por Cuenta (Donut)</CardTitle>
              </CardHeader>
              <CardContent className="h-[380px]">
                <ResponsivePie
                  data={mockPie}
                  margin={{ top: 30, right: 30, bottom: 50, left: 60 }}
                  innerRadius={0.6}
                  padAngle={1.5}
                  cornerRadius={6}
                  colors={d => d.id === selectedPie ? '#f59e42' : d.data.color}
                  borderWidth={2}
                  borderColor={{ from: 'color', modifiers: [['darker', 0.3]] }}
                  enableArcLabels={false}
                  arcLinkLabelsTextColor={theme === 'dark' ? '#e5e7eb' : '#222'}
                  arcLinkLabelsColor={{ from: 'color' }}
                  activeOuterRadiusOffset={8}
                  theme={nivoTheme}
                  animate={true}
                  motionConfig="wobbly"
                  legends={[]}
                  tooltip={({ datum }) => (
                    <div>
                      <div className="font-bold text-lg mb-1">{datum.label}</div>
                      <div>Monto: <b>{datum.value}</b></div>
                      <div style={{ color: datum.color }}>Color: {datum.color}</div>
                    </div>
                  )}
                  onClick={datum => setSelectedPie(datum.id as string)}
                />
                </CardContent>
              <CardFooter>
                <div style={legendWrapperStyle}>
                  {mockPie.map(pie => (
                    <span key={pie.id} style={legendTextStyle}>
                      <span style={{ display: 'inline-block', width: legendSymbolSize, height: legendSymbolSize, borderRadius: '50%', background: pie.color, marginRight: 8, verticalAlign: 'middle' }} />
                      {pie.label}
                    </span>
                  ))}
                </div>
              </CardFooter>
            </Card>
          </div>
        </div>
      </div>
    </>
  )
} 