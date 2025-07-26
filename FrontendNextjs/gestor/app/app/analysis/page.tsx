'use client'

import { ResponsiveLine } from '@nivo/line'
import { ResponsiveBar } from '@nivo/bar'
import { ResponsiveRadar } from '@nivo/radar'
import { ResponsiveHeatMap } from '@nivo/heatmap'
import { ResponsivePie } from '@nivo/pie'
import { useTheme } from 'next-themes'
import { useMemo, useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CalendarDateRangePicker } from '@/components/date-range-picker'
import { parse, differenceInDays, differenceInMonths, differenceInYears, format, startOfWeek, addDays, addWeeks, addMonths, addYears, startOfMonth, startOfYear } from 'date-fns'
import { useAccounts, useCategories, useTransactions, useAnalytics } from '@/hooks/useRepositories'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter, DrawerClose } from '@/components/ui/drawer'
import { DateRange } from 'react-day-picker'
import { Account } from '@/types/account'

// Datos mock para ejemplo visual
const mockLine = [
  {
    id: 'Saldo',
    color: '#3b82f6',
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
    color: '#22c55e',
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
    color: '#ef4444',
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
  { id: 'Cuenta 1', label: 'Cuenta 1', value: 1200, color: '#3b82f6' },
  { id: 'Cuenta 2', label: 'Cuenta 2', value: 800, color: '#22c55e' },
  { id: 'Cuenta 3', label: 'Cuenta 3', value: 600, color: '#eab308' },
]

const typeOptions = [
  { value: 'INCOME', label: 'Ingreso' },
  { value: 'BILL', label: 'Gasto' },
]
const months = [
  { value: 'all', label: 'Todos' },
  { value: '01', label: 'Enero' },
  { value: '02', label: 'Febrero' },
  { value: '03', label: 'Marzo' },
  { value: '04', label: 'Abril' },
  { value: '05', label: 'Mayo' },
  { value: '06', label: 'Junio' },
  { value: '07', label: 'Julio' },
  { value: '08', label: 'Agosto' },
  { value: '09', label: 'Septiembre' },
  { value: '10', label: 'Octubre' },
  { value: '11', label: 'Noviembre' },
  { value: '12', label: 'Diciembre' },
]
const now = new Date()
const defaultMonth = String(now.getMonth() + 1).padStart(2, '0')
const defaultYear = String(now.getFullYear())

// Generar opciones de años dinámicamente para incluir el año actual y futuros
const minYear = 2022
const maxYear = now.getFullYear() + 1 // Incluye el próximo año por si acaso
const years = Array.from({ length: maxYear - minYear + 1 }, (_, i) => {
  const y = String(minYear + i)
  return { value: y, label: y }
})

// Definir el tipo para los filtros
interface AnalysisFiltersState {
  filterMode: 'month' | 'range'
  month: string
  year: string
  dateRange: DateRange
  account: string
  category: string
  type: string
  minAmount: string
  maxAmount: string
  search: string
}

function AnalysisFilters({ filters, setFilters }: {
  filters: AnalysisFiltersState
  setFilters: React.Dispatch<React.SetStateAction<AnalysisFiltersState>>
}) {
  return (
    <form className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8'>
      <div className='md:col-span-2 lg:col-span-3 flex flex-col gap-2'>
        <Label>Modo de filtro de fecha</Label>
        <div className='flex gap-2'>
          <Button
            type='button'
            variant={filters.filterMode === 'month' ? 'default' : 'outline'}
            onClick={() => setFilters(f => ({ ...f, filterMode: 'month', dateRange: { from: undefined, to: undefined } }))}
          >
            Mes/Año
          </Button>
          <Button
            type='button'
            variant={filters.filterMode === 'range' ? 'default' : 'outline'}
            onClick={() => setFilters(f => ({ ...f, filterMode: 'range', month: 'all', year: '' }))}
          >
            Rango de fechas
          </Button>
        </div>
      </div>
      {filters.filterMode === 'month' && (
        <>
          <div>
            <Label htmlFor='month'>Mes</Label>
            <Select value={filters.month} onValueChange={v => setFilters(f => ({ ...f, month: v }))}>
              <SelectTrigger id='month' className='w-full'>
                <SelectValue placeholder='Selecciona mes' />
              </SelectTrigger>
              <SelectContent>
                {months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor='year'>Año</Label>
            <Select value={filters.year} onValueChange={v => setFilters(f => ({ ...f, year: v }))}>
              <SelectTrigger id='year' className='w-full'>
                <SelectValue placeholder='Selecciona año' />
              </SelectTrigger>
              <SelectContent>
                {years.map(y => <SelectItem key={y.value} value={y.value}>{y.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </>
      )}
      {filters.filterMode === 'range' && (
        <div className='md:col-span-2 lg:col-span-3'>
          <Label>Rango de fechas</Label>
          <CalendarDateRangePicker
            value={filters.dateRange}
            onChange={dateRange => {
              if (dateRange && typeof dateRange === 'object' && 'from' in dateRange && 'to' in dateRange) {
                setFilters(f => ({ ...f, dateRange }))
              }
            }}
          />
        </div>
      )}
      <div>
        <Label htmlFor='account'>Cuenta</Label>
        <Select value={filters.account} onValueChange={v => setFilters(f => ({ ...f, account: v }))}>
          <SelectTrigger id='account' className='w-full'>
            <SelectValue placeholder='Todas las cuentas' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>Todas</SelectItem>
            {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor='category'>Categoría</Label>
        <Select value={filters.category} onValueChange={v => setFilters(f => ({ ...f, category: v }))}>
          <SelectTrigger id='category' className='w-full'>
            <SelectValue placeholder='Todas las categorías' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>Todas</SelectItem>
            {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor='type'>Tipo</Label>
        <Select value={filters.type} onValueChange={v => setFilters(f => ({ ...f, type: v }))}>
          <SelectTrigger id='type' className='w-full'>
            <SelectValue placeholder='Todos los tipos' />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>Todos</SelectItem>
            {typeOptions.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor='minAmount'>Monto mínimo</Label>
        <Input id='minAmount' type='number' value={filters.minAmount} onChange={e => setFilters(f => ({ ...f, minAmount: e.target.value }))} placeholder='0' min={0} className='w-full' />
      </div>
      <div>
        <Label htmlFor='maxAmount'>Monto máximo</Label>
        <Input id='maxAmount' type='number' value={filters.maxAmount} onChange={e => setFilters(f => ({ ...f, maxAmount: e.target.value }))} placeholder='99999' min={0} className='w-full' />
      </div>
      <div className='md:col-span-2 lg:col-span-3'>
        <Label htmlFor='search'>Buscar</Label>
        <Input id='search' type='text' value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} placeholder='Buscar por nombre o descripción...' className='w-full' />
      </div>
    </form>
  )
}

// Calcular el intervalo de agrupación para el gráfico de líneas
function getDateRangeInterval(start: Date, end: Date) {
  const days = differenceInDays(end, start)
  const months = differenceInMonths(end, start)
  const years = differenceInYears(end, start)
  if (days <= 31) return 'day'
  if (days <= 90) return 'week'
  if (years < 2) return 'month'
  return 'year'
}

// Server Component para AccountCard
function AccountCard({ account }: { account: Account }) {
  // ... existing code ...
}

export default function AnalysisPage() {
  const { theme } = useTheme()
  const { accounts, isLoading: accountsLoading } = useAccounts()
  const { categories, isLoading: categoriesLoading } = useCategories()
  const { transactions, isLoading: transactionsLoading } = useTransactions()
  const { categoryExpenses, monthlySummary, isLoadingCategoryExpenses, isLoadingMonthlySummary, loadCategoryExpenses, loadMonthlySummary } = useAnalytics()
  const [filters, setFilters] = useState<AnalysisFiltersState>({
    filterMode: 'month',
    month: defaultMonth,
    year: defaultYear,
    dateRange: { from: undefined, to: undefined },
    account: 'all',
    category: 'all',
    type: 'all',
    minAmount: '',
    maxAmount: '',
    search: '',
  })
  
  const loading = accountsLoading || categoriesLoading || transactionsLoading || isLoadingCategoryExpenses || isLoadingMonthlySummary

  // Mapear filtros UI a filtros de API
  const apiFilters = useMemo(() => {
    const f: any = {}
    if (filters.account && filters.account !== 'all') f.accountId = filters.account
    if (filters.category && filters.category !== 'all') f.categoryId = filters.category
    if (filters.type && filters.type !== 'all') f.type = filters.type
    if (filters.filterMode === 'month') {
      if (filters.month && filters.month !== 'all') {
        f.dateFrom = `${filters.year}-${filters.month}-01`
        f.dateTo = `${filters.year}-${filters.month}-31`
      } else if (filters.year) {
        f.dateFrom = `${filters.year}-01-01`
        f.dateTo = `${filters.year}-12-31`
      }
    } else if (filters.filterMode === 'range' && filters.dateRange.from && filters.dateRange.to) {
      f.dateFrom = filters.dateRange.from.toISOString().slice(0, 10)
      f.dateTo = filters.dateRange.to.toISOString().slice(0, 10)
    }
    if (filters.minAmount) f.minAmount = Number(filters.minAmount)
    if (filters.maxAmount) f.maxAmount = Number(filters.maxAmount)
    if (filters.search) f.search = filters.search
    // Agrupación automática
    if (f.dateFrom && f.dateTo) {
      const start = new Date(f.dateFrom)
      const end = new Date(f.dateTo)
      const days = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
      if (days <= 31) f.groupBy = 'day'
      else if (days <= 90) f.groupBy = 'week'
      else if (days < 365 * 2) f.groupBy = 'month'
      else f.groupBy = 'year'
    } else {
      f.groupBy = 'month'
    }
    return f
  }, [filters])

  useEffect(() => {
    loadCategoryExpenses()
    loadMonthlySummary()
  }, [])

  const nivoTheme = useMemo(() => ({
    background: 'transparent',
    textColor: theme === 'dark' ? '#e5e7eb' : '#374151',
    fontSize: 12,
    fontFamily: 'Inter, system-ui, sans-serif',
    axis: {
      domain: {
        line: {
          stroke: theme === 'dark' ? '#4b5563' : '#d1d5db',
          strokeWidth: 1
        }
      },
      legend: { 
        text: { 
          fill: theme === 'dark' ? '#e5e7eb' : '#374151',
          fontSize: 13,
          fontWeight: 500
        } 
      },
      ticks: { 
        line: {
          stroke: theme === 'dark' ? '#6b7280' : '#9ca3af',
          strokeWidth: 1
        },
        text: { 
          fill: theme === 'dark' ? '#d1d5db' : '#6b7280',
          fontSize: 11
        } 
      }
    },
    grid: {
      line: {
        stroke: theme === 'dark' ? '#374151' : '#e5e7eb',
        strokeWidth: 1
      }
    },
    legends: { 
      text: { 
        fill: theme === 'dark' ? '#e5e7eb' : '#374151',
        fontSize: 12,
        fontWeight: 500
      } 
    },
    tooltip: {
      container: {
        background: theme === 'dark' ? '#1f2937' : '#ffffff',
        color: theme === 'dark' ? '#f9fafb' : '#111827',
        borderRadius: '8px',
        border: `1px solid ${theme === 'dark' ? '#374151' : '#e5e7eb'}`,
        boxShadow: theme === 'dark' 
          ? '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.2)'
          : '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        fontWeight: 500,
        fontSize: 13,
        padding: '12px 16px',
      },
      basic: {
        whiteSpace: 'pre',
        display: 'flex',
        alignItems: 'center'
      },
      table: {},
      tableCell: {
        padding: '3px 5px'
      }
    },
  }), [theme])

  const [drawerOpen, setDrawerOpen] = useState(false)

  if (loading) return <div className='p-8 text-center text-lg'>Cargando analíticas...</div>

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 dark:from-background dark:via-background dark:to-muted/20">
        <div className="container mx-auto px-4 py-8">
          <div className="mb-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-foreground via-primary to-primary bg-clip-text text-transparent">
                  Analíticas
                </h1>
                <p className="text-muted-foreground mt-2 text-lg">
                  Visualiza y explora tus datos financieros con filtros avanzados
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" className="border-border/50" onClick={() => setDrawerOpen(true)}>
                  Filtrar
                </Button>
              </div>
            </div>
          </div>
          <Drawer open={drawerOpen} onOpenChange={setDrawerOpen} side="right">
            <DrawerContent side="right" className="p-6">
              <DrawerHeader>
                <DrawerTitle>Filtrar Analíticas</DrawerTitle>
              </DrawerHeader>
              <AnalysisFilters filters={filters} setFilters={setFilters} />
              <DrawerFooter>
                <Button type="button" variant="outline" onClick={() => setFilters({
                  filterMode: 'month',
                  month: defaultMonth,
                  year: defaultYear,
                  dateRange: { from: undefined, to: undefined },
                  account: 'all',
                  category: 'all',
                  type: 'all',
                  minAmount: '',
                  maxAmount: '',
                  search: '',
                })} className="w-full">Limpiar Filtros</Button>
                <DrawerClose asChild>
                  <Button type="button" variant="ghost" className="w-full">Cerrar</Button>
                </DrawerClose>
              </DrawerFooter>
            </DrawerContent>
          </Drawer>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
            <Card>
              <CardHeader>
                <CardTitle>Ingresos y Gastos por Mes</CardTitle>
              </CardHeader>
              <CardContent style={{ height: 300 }}>
                <ResponsiveLine
                  data={monthlySummary.length > 0 ? [
                    {
                      id: 'Ingresos',
                      color: theme === 'dark' ? '#22c55e' : '#16a34a',
                      data: monthlySummary.map(m => ({ x: m.month, y: m.Ingresos }))
                    },
                    {
                      id: 'Gastos', 
                      color: theme === 'dark' ? '#ef4444' : '#dc2626',
                      data: monthlySummary.map(m => ({ x: m.month, y: Math.abs(m.Gastos) }))
                    }
                  ] : mockLine}
                  theme={nivoTheme}
                  margin={{ top: 30, right: 30, bottom: 60, left: 60 }}
                  xScale={{ type: 'point' }}
                  yScale={{ type: 'linear', min: 'auto', max: 'auto', stacked: false, reverse: false }}
                  axisBottom={{
                    tickSize: 5,
                    tickPadding: 5,
                    tickRotation: 45,
                    legend: apiFilters.groupBy === 'day' ? 'Día' : apiFilters.groupBy === 'week' ? 'Semana' : apiFilters.groupBy === 'month' ? 'Mes' : 'Año',
                    legendOffset: 48,
                    legendPosition: 'middle',
                    tickValues: monthlySummary.length > 15
                      ? monthlySummary.filter((_, i) => i % Math.ceil(monthlySummary.length / 10) === 0).map(d => d.month)
                      : undefined,
                    format: v => {
                      if (apiFilters.groupBy === 'day') return String(v).slice(0, 5)
                      if (apiFilters.groupBy === 'week') return String(v).replace('Semana ', 'S')
                      if (apiFilters.groupBy === 'month') return String(v).slice(0, 7)
                      return v
                    },
                  }}
                  axisLeft={{ tickSize: 5, tickPadding: 5, tickRotation: 0, legend: 'Monto', legendOffset: -50, legendPosition: 'middle' }}
                  pointSize={10}
                  pointColor={{ theme: 'background' }}
                  pointBorderWidth={2}
                  pointBorderColor={{ from: 'serieColor' }}
                  enablePointLabel={false}
                  useMesh={true}
                  legends={[
                    {
                      anchor: 'bottom-right',
                      direction: 'column',
                      justify: false,
                      translateX: 100,
                      translateY: 0,
                      itemsSpacing: 0,
                      itemDirection: 'left-to-right',
                      itemWidth: 80,
                      itemHeight: 20,
                      itemOpacity: 0.75,
                      symbolSize: 12,
                      symbolShape: 'circle',
                      symbolBorderColor: 'rgba(0, 0, 0, .5)',
                      itemTextColor: theme === 'dark' ? '#e5e7eb' : '#374151',
                      effects: [
                        {
                          on: 'hover',
                          style: {
                            itemBackground: theme === 'dark' ? 'rgba(255, 255, 255, .03)' : 'rgba(0, 0, 0, .03)',
                            itemOpacity: 1,
                            itemTextColor: theme === 'dark' ? '#ffffff' : '#000000'
                          }
                        }
                      ]
                    }
                  ]}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Gastos por Categoría</CardTitle>
              </CardHeader>
              <CardContent style={{ height: 300 }}>
                <ResponsiveBar
                  data={categoryExpenses.length > 0 ? categoryExpenses.map(cat => ({
                    categoria: cat.label,
                    monto: Math.abs(cat.value)
                  })) : mockBar}
                  keys={['monto']}
                  indexBy='categoria'
                  margin={{ top: 30, right: 30, bottom: 60, left: 60 }}
                  padding={0.3}
                  valueScale={{ type: 'linear' }}
                  indexScale={{ type: 'band', round: true }}
                  colors={theme === 'dark' ? [
                    '#3b82f6', '#22c55e', '#eab308', '#ef4444', '#8b5cf6', 
                    '#06b6d4', '#f97316', '#ec4899', '#84cc16', '#f59e0b'
                  ] : [
                    '#2563eb', '#16a34a', '#ca8a04', '#dc2626', '#7c3aed',
                    '#0891b2', '#ea580c', '#db2777', '#65a30d', '#d97706'
                  ]}
                  borderColor={{ from: 'color', modifiers: [['darker', 1.6]] }}
                  axisTop={null}
                  axisRight={null}
                  axisBottom={{
                    tickSize: 5,
                    tickPadding: 5,
                    tickRotation: 45,
                    legend: apiFilters.groupBy === 'day' ? 'Día' : apiFilters.groupBy === 'week' ? 'Semana' : apiFilters.groupBy === 'month' ? 'Mes' : 'Año',
                    legendOffset: 48,
                    legendPosition: 'middle',
                    tickValues: categoryExpenses.length > 15
                      ? categoryExpenses.filter((_, i) => i % Math.ceil(categoryExpenses.length / 10) === 0).map(d => d.label)
                      : undefined,
                    format: v => {
                      if (apiFilters.groupBy === 'day') return String(v).slice(0, 5)
                      if (apiFilters.groupBy === 'week') return String(v).replace('Semana ', 'S')
                      if (apiFilters.groupBy === 'month') return String(v).slice(0, 7)
                      return v
                    },
                  }}
                  axisLeft={{ tickSize: 5, tickPadding: 5, tickRotation: 0, legend: 'Monto', legendOffset: -50, legendPosition: 'middle' }}
                  labelSkipWidth={12}
                  labelSkipHeight={12}
                  labelTextColor={{ from: 'color', modifiers: [['darker', 1.6]] }}
                  legends={[
                    {
                      dataFrom: 'keys',
                      anchor: 'bottom-right',
                      direction: 'column',
                      justify: false,
                      translateX: 120,
                      translateY: 0,
                      itemsSpacing: 2,
                      itemWidth: 100,
                      itemHeight: 20,
                      itemDirection: 'left-to-right',
                      itemOpacity: 0.85,
                      symbolSize: 20,
                      itemTextColor: theme === 'dark' ? '#e5e7eb' : '#374151',
                      effects: [
                        {
                          on: 'hover',
                          style: {
                            itemOpacity: 1,
                            itemTextColor: theme === 'dark' ? '#ffffff' : '#000000'
                          }
                        }
                      ]
                    }
                  ]}
                  theme={nivoTheme}
                  groupMode='stacked'
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Distribución por Categoría</CardTitle>
              </CardHeader>
              <CardContent style={{ height: 300 }}>
                <ResponsivePie data={categoryExpenses.length > 0 ? categoryExpenses.map(cat => ({
                    id: cat.id,
                    label: cat.label,
                    value: Math.abs(cat.value),
                    color: cat.color
                  })) : mockPie} margin={{ top: 30, right: 30, bottom: 50, left: 60 }} innerRadius={0.5} padAngle={0.7} cornerRadius={3} activeOuterRadiusOffset={8} borderWidth={1} borderColor={{ from: 'color', modifiers: [['darker', 0.2]] }} arcLinkLabelsSkipAngle={10} arcLinkLabelsTextColor={theme === 'dark' ? '#e5e7eb' : '#222'} arcLinkLabelsThickness={2} arcLinkLabelsColor={{ from: 'color' }} arcLabelsSkipAngle={10} arcLabelsTextColor={{ from: 'color', modifiers: [['darker', 2]] }} theme={nivoTheme} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Radar de Categorías</CardTitle>
              </CardHeader>
              <CardContent style={{ height: 300 }}>
                <ResponsiveRadar data={categoryExpenses.length > 0 ? categoryExpenses.map(cat => ({
                    categoria: cat.label,
                    Gastos: Math.abs(cat.value),
                    Ingresos: 0
                  })) : mockRadar} keys={['Gastos', 'Ingresos']} indexBy='categoria' maxValue='auto' margin={{ top: 30, right: 30, bottom: 50, left: 60 }} curve='linearClosed' borderWidth={2} borderColor={{ from: 'color' }} gridLevels={5} gridShape='circular' gridLabelOffset={36} enableDots={true} dotSize={8} dotColor={{ theme: 'background' }} dotBorderWidth={2} dotBorderColor={{ from: 'color' }} enableDotLabel={true} dotLabel='value' dotLabelYOffset={-12} colors={theme === 'dark' ? ['#ef4444', '#22c55e'] : ['#dc2626', '#16a34a']} fillOpacity={0.25} blendMode='multiply' animate={true} isInteractive={true} theme={nivoTheme} />
              </CardContent>
            </Card>
            <Card className='md:col-span-2'>
              <CardHeader>
                <CardTitle>Mapa de Calor Semanal</CardTitle>
              </CardHeader>
              <CardContent style={{ height: 300 }}>
                <ResponsiveHeatMap
                  data={mockHeat}
                  margin={{ top: 30, right: 30, bottom: 50, left: 60 }}
                  forceSquare={true}
                  axisTop={null}
                  axisRight={null}
                  axisBottom={{ tickSize: 5, tickPadding: 5, tickRotation: 0, legend: 'Mes', legendOffset: 36, legendPosition: 'middle' }}
                  axisLeft={{ tickSize: 5, tickPadding: 5, tickRotation: 0, legend: 'Día', legendOffset: -50, legendPosition: 'middle' }}
                  borderColor={{ from: 'color', modifiers: [['darker', 0.4]] }}
                  labelTextColor={{ from: 'color', modifiers: [['darker', 1.8]] }}
                  theme={nivoTheme}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  )
} 