'use client'

import { ResponsiveLine } from '@nivo/line'
import { ResponsiveBar } from '@nivo/bar'
import { ResponsiveRadar } from '@nivo/radar'
import { ResponsiveHeatMap } from '@nivo/heatmap'
import { ResponsivePie } from '@nivo/pie'
import { useTheme } from 'next-themes'
import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CalendarDateRangePicker } from '@/components/date-range-picker'
import { parse, differenceInDays, differenceInMonths, differenceInYears, format, startOfWeek, addDays, addWeeks, addMonths, addYears, startOfMonth, startOfYear } from 'date-fns'
import { useAccounts, useCategories, useTransactions } from '@/hooks/useRepositories'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter, DrawerClose } from '@/components/ui/drawer'
import { DateRange } from 'react-day-picker'

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

// Datos de ejemplo para filtros
const exampleAccounts = [
  { id: '1', name_account: 'Cuenta Principal' },
  { id: '2', name_account: 'Cuenta Ahorros' },
  { id: '3', name_account: 'Cuenta Corriente' },
]
const exampleCategories = [
  { id: 'category-1', name: 'Alimentación' },
  { id: 'category-2', name: 'Transporte' },
  { id: 'category-3', name: 'Entretenimiento' },
  { id: 'category-4', name: 'Salud' },
  { id: 'category-5', name: 'Educación' },
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
            {exampleAccounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name_account}</SelectItem>)}
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
            {exampleCategories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
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

export default function AnalysisPage() {
  const { theme } = useTheme()
  const { accounts } = useAccounts()
  const { categories } = useCategories()
  const { transactions } = useTransactions()
  const [selectedBar, setSelectedBar] = useState<string | null>(null)
  const [selectedPie, setSelectedPie] = useState<string | null>(null)
  const [selectedLine, setSelectedLine] = useState<{ serieId: string, pointIndex: number } | null>(null)
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

  // Utilidad para obtener el mes y año de un label tipo 'Ene', 'Feb', etc.
  const monthMap: Record<string, string> = {
    'Ene': '01', 'Feb': '02', 'Mar': '03', 'Abr': '04', 'May': '05', 'Jun': '06',
    'Jul': '07', 'Ago': '08', 'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dic': '12',
  }

  // Reemplazar exampleAccounts y exampleCategories por los datos reales
  const exampleAccounts = accounts.map(a => ({ id: a.id, name_account: a.name_account }))
  const exampleCategories = categories.map(c => ({ id: c.id, name: c.name }))

  // Filtrar transacciones según los filtros activos
  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      // Filtro por cuenta
      if (filters.account !== 'all' && tx.account_id !== filters.account) return false
      // Filtro por categoría
      if (filters.category !== 'all' && tx.category_id !== filters.category) return false
      // Filtro por tipo
      if (filters.type !== 'all') {
        if (filters.type === 'INCOME' && tx.type_transaction !== 1) return false
        if (filters.type === 'BILL' && tx.type_transaction !== 0) return false
      }
      // Filtro por fecha
      if (filters.filterMode === 'month') {
        if (filters.month !== 'all' && filters.month) {
          const txMonth = (tx.created_at instanceof Date ? tx.created_at : new Date(tx.created_at)).getMonth() + 1
          if (String(txMonth).padStart(2, '0') !== filters.month) return false
        }
        if (filters.year) {
          const txYear = (tx.created_at instanceof Date ? tx.created_at : new Date(tx.created_at)).getFullYear()
          if (String(txYear) !== filters.year) return false
        }
      } else if (filters.filterMode === 'range') {
        if (filters.dateRange.from && filters.dateRange.to) {
          const txDate = tx.created_at instanceof Date ? tx.created_at : new Date(tx.created_at)
          if (txDate < filters.dateRange.from || txDate > filters.dateRange.to) return false
        }
      }
      // Filtro por monto
      if (filters.minAmount && tx.amount < Number(filters.minAmount)) return false
      if (filters.maxAmount && tx.amount > Number(filters.maxAmount)) return false
      // Filtro por búsqueda
      if (filters.search) {
        const search = filters.search.toLowerCase()
        if (!tx.name.toLowerCase().includes(search) && !tx.description.toLowerCase().includes(search)) return false
      }
      return true
    })
  }, [transactions, filters])

  // Determinar rango de fechas para el gráfico de líneas
  let start: Date, end: Date
  if (filters.filterMode === 'range' && filters.dateRange.from && filters.dateRange.to) {
    start = filters.dateRange.from
    end = filters.dateRange.to
  } else {
    const txDates = filteredTransactions.map(tx => tx.created_at instanceof Date ? tx.created_at : new Date(tx.created_at))
    start = new Date(Math.min(...txDates.map(d => d.getTime())))
    end = new Date(Math.max(...txDates.map(d => d.getTime())))
  }
  const interval = getDateRangeInterval(start, end)

  // Generar datos para los gráficos a partir de filteredTransactions
  // Línea: evolución de ingresos/gastos/saldo por mes
  const filteredLineData = useMemo(() => {
    if (filteredTransactions.length === 0) return [
      { id: 'Saldo', color: 'hsl(210, 70%, 50%)', data: [] },
      { id: 'Ingresos', color: 'hsl(140, 70%, 50%)', data: [] },
      { id: 'Gastos', color: 'hsl(0, 70%, 50%)', data: [] },
    ]
    // Declarar labels dentro del useMemo
    let labels: string[] = []
    // Calcular intervalo
    const days = differenceInDays(end, start)
    const months = differenceInMonths(end, start)
    const years = differenceInYears(end, start)
    let getLabel: (date: Date) => string
    let addFn: (date: Date, n: number) => Date
    let startFn: (date: Date) => Date
    if (interval === 'day') {
      getLabel = d => format(d, 'dd/MM/yyyy')
      addFn = addDays
      startFn = d => d
      let d = start
      while (d <= end) {
        labels.push(getLabel(d))
        d = addFn(d, 1)
      }
    } else if (interval === 'week') {
      getLabel = d => 'Semana ' + format(d, 'w yyyy')
      addFn = addWeeks
      startFn = d => startOfWeek(d, { weekStartsOn: 1 })
      let d = startFn(start)
      while (d <= end) {
        labels.push(getLabel(d))
        d = addFn(d, 1)
      }
    } else if (interval === 'month') {
      getLabel = d => format(d, 'MMM yyyy')
      addFn = addMonths
      startFn = startOfMonth
      let d = startFn(start)
      while (d <= end) {
        labels.push(getLabel(d))
        d = addFn(d, 1)
      }
    } else {
      getLabel = d => format(d, 'yyyy')
      addFn = addYears
      startFn = startOfYear
      let d = startFn(start)
      while (d <= end) {
        labels.push(getLabel(d))
        d = addFn(d, 1)
      }
    }

    // Agrupar transacciones por intervalo
    const groupMap: Record<string, { ingresos: number, gastos: number }> = {}
    labels.forEach(l => { groupMap[l] = { ingresos: 0, gastos: 0 } })
    filteredTransactions.forEach(tx => {
      const date = tx.created_at instanceof Date ? tx.created_at : new Date(tx.created_at)
      let label = getLabel(startFn(date))
      if (!(label in groupMap)) return // fuera de rango
      if (tx.type_transaction === 1) groupMap[label].ingresos += tx.amount
      else if (tx.type_transaction === 0) groupMap[label].gastos += tx.amount
    })
    // Calcular saldo acumulado
    let saldoAcumulado = 0
    const saldoData: { x: string, y: number }[] = []
    const ingresosData: { x: string, y: number }[] = []
    const gastosData: { x: string, y: number }[] = []
    labels.forEach(l => {
      saldoAcumulado += groupMap[l].ingresos - groupMap[l].gastos
      saldoData.push({ x: l, y: saldoAcumulado })
      ingresosData.push({ x: l, y: groupMap[l].ingresos })
      gastosData.push({ x: l, y: groupMap[l].gastos })
    })
    return [
      { id: 'Saldo', color: 'hsl(210, 70%, 50%)', data: saldoData },
      { id: 'Ingresos', color: 'hsl(140, 70%, 50%)', data: ingresosData },
      { id: 'Gastos', color: 'hsl(0, 70%, 50%)', data: gastosData },
    ]
  }, [filteredTransactions, filters, start, end, interval])

  // Nueva estructura para el gráfico de barras: eje X = fecha, barras apiladas por categoría
  const filteredBarData = useMemo(() => {
    if (filteredTransactions.length === 0) return []
    // Obtener todas las fechas únicas en el rango
    let labels: string[] = []
    let getLabel: (date: Date) => string
    let addFn: (date: Date, n: number) => Date
    let startFn: (date: Date) => Date
    if (interval === 'day') {
      getLabel = d => format(d, 'dd/MM/yyyy')
      addFn = addDays
      startFn = d => d
      let d = start
      while (d <= end) {
        labels.push(getLabel(d))
        d = addFn(d, 1)
      }
    } else if (interval === 'week') {
      getLabel = d => 'Semana ' + format(d, 'w yyyy')
      addFn = addWeeks
      startFn = d => startOfWeek(d, { weekStartsOn: 1 })
      let d = startFn(start)
      while (d <= end) {
        labels.push(getLabel(d))
        d = addFn(d, 1)
      }
    } else if (interval === 'month') {
      getLabel = d => format(d, 'MMM yyyy')
      addFn = addMonths
      startFn = startOfMonth
      let d = startFn(start)
      while (d <= end) {
        labels.push(getLabel(d))
        d = addFn(d, 1)
      }
    } else {
      getLabel = d => format(d, 'yyyy')
      addFn = addYears
      startFn = startOfYear
      let d = startFn(start)
      while (d <= end) {
        labels.push(getLabel(d))
        d = addFn(d, 1)
      }
    }
    // Obtener todas las categorías únicas
    const categoryNames = categories.map(cat => cat.name)
    // Construir los datos: cada objeto es { fecha, 'Alimentación': monto, ... }
    const data = labels.map(label => {
      const row: Record<string, string | number> = { fecha: label }
      categoryNames.forEach(catName => { row[catName] = 0 })
      // Sumar montos por categoría para esa fecha
      filteredTransactions.forEach(tx => {
        if (tx.type_transaction === 0) {
          const txDate = tx.created_at instanceof Date ? tx.created_at : new Date(tx.created_at)
          const txLabel = getLabel(startFn(txDate))
          if (txLabel === label) {
            const cat = categories.find(c => c.id === tx.category_id)
            if (cat) row[cat.name] = (row[cat.name] as number) + tx.amount
          }
        }
      })
      return row
    })
    return data
  }, [filteredTransactions, categories, interval, start, end])

  // Pie: distribución por cuenta
  const filteredPieData = useMemo(() => {
    return accounts.map(acc => {
      const value = filteredTransactions
        .filter(tx => tx.account_id === acc.id)
        .reduce((sum, tx) => sum + tx.amount, 0)
      return { id: acc.id, label: acc.name_account, value, color: '#2563eb' }
    }).filter(pie => pie.value > 0)
  }, [filteredTransactions, accounts])

  // Radar: comparación de categorías (gastos e ingresos)
  const filteredRadarData = useMemo(() => {
    // Calcular el monto total por categoría
    const categoryTotals = categories.map(cat => {
      const gastos = filteredTransactions
        .filter(tx => tx.category_id === cat.id && tx.type_transaction === 0)
        .reduce((sum, tx) => sum + tx.amount, 0)
      const ingresos = filteredTransactions
        .filter(tx => tx.category_id === cat.id && tx.type_transaction === 1)
        .reduce((sum, tx) => sum + tx.amount, 0)
      return { categoria: cat.name, Gastos: gastos, Ingresos: ingresos, total: gastos + ingresos }
    })
    // Ordenar por total y tomar top 5
    const topCategories = categoryTotals
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
    // Devolver solo las top 5 en el formato esperado por el radar
    return topCategories.map(({ categoria, Gastos, Ingresos }) => ({ categoria, Gastos, Ingresos }))
  }, [filteredTransactions, categories])

  // Ajustar el heatmap para mostrar solo el rango seleccionado
  const filteredHeatData = useMemo(() => {
    const monthsLabels = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
    const days = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom']
    let visibleMonths: string[] = []
    if (interval === 'month' || interval === 'week' || interval === 'day') {
      let d = startOfMonth(start)
      while (d <= end) {
        visibleMonths.push(monthsLabels[d.getMonth()])
        d = addMonths(d, 1)
      }
    } else {
      visibleMonths = monthsLabels
    }
    return days.map((day, i) => ({
      id: day,
      data: visibleMonths.map(month => {
        const count = filteredTransactions.filter(tx => {
          const date = tx.created_at instanceof Date ? tx.created_at : new Date(tx.created_at)
          return date.getDay() === ((i + 1) % 7) && monthsLabels[date.getMonth()] === month
        }).length
        return { x: month, y: count }
      })
    }))
  }, [filteredTransactions, interval, start, end])

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

  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <>
      <style>{legendFadeIn}</style>
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
                <CardTitle>Saldo, Ingresos y Gastos</CardTitle>
              </CardHeader>
              <CardContent style={{ height: 300 }}>
                <ResponsiveLine
                  data={filteredLineData}
                  theme={nivoTheme}
                  margin={{ top: 30, right: 30, bottom: 60, left: 60 }}
                  xScale={{ type: 'point' }}
                  yScale={{ type: 'linear', min: 'auto', max: 'auto', stacked: false, reverse: false }}
                  axisBottom={{
                    tickSize: 5,
                    tickPadding: 5,
                    tickRotation: 45,
                    legend: interval === 'day' ? 'Día' : interval === 'week' ? 'Semana' : interval === 'month' ? 'Mes' : 'Año',
                    legendOffset: 48,
                    legendPosition: 'middle',
                    tickValues: filteredLineData[0]?.data.length > 15
                      ? filteredLineData[0].data.filter((_, i) => i % Math.ceil(filteredLineData[0].data.length / 10) === 0).map(d => d.x)
                      : undefined,
                    format: v => {
                      if (interval === 'day') return String(v).slice(0, 5)
                      if (interval === 'week') return String(v).replace('Semana ', 'S')
                      if (interval === 'month') return String(v).slice(0, 7)
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
                  legends={[]}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Gastos por Categoría</CardTitle>
              </CardHeader>
              <CardContent style={{ height: 300 }}>
                <ResponsiveBar
                  data={filteredBarData}
                  keys={categories.map(cat => cat.name)}
                  indexBy='fecha'
                  margin={{ top: 30, right: 30, bottom: 60, left: 60 }}
                  padding={0.3}
                  valueScale={{ type: 'linear' }}
                  indexScale={{ type: 'band', round: true }}
                  colors={{ scheme: 'nivo' }}
                  borderColor={{ from: 'color', modifiers: [['darker', 1.6]] }}
                  axisTop={null}
                  axisRight={null}
                  axisBottom={{
                    tickSize: 5,
                    tickPadding: 5,
                    tickRotation: 45,
                    legend: interval === 'day' ? 'Día' : interval === 'week' ? 'Semana' : interval === 'month' ? 'Mes' : 'Año',
                    legendOffset: 48,
                    legendPosition: 'middle',
                    tickValues: filteredBarData.length > 15
                      ? filteredBarData.filter((_, i) => i % Math.ceil(filteredBarData.length / 10) === 0).map(d => d.fecha)
                      : undefined,
                    format: v => {
                      if (interval === 'day') return String(v).slice(0, 5)
                      if (interval === 'week') return String(v).replace('Semana ', 'S')
                      if (interval === 'month') return String(v).slice(0, 7)
                      return v
                    },
                  }}
                  axisLeft={{ tickSize: 5, tickPadding: 5, tickRotation: 0, legend: 'Monto', legendOffset: -50, legendPosition: 'middle' }}
                  labelSkipWidth={12}
                  labelSkipHeight={12}
                  labelTextColor={{ from: 'color', modifiers: [['darker', 1.6]] }}
                  legends={[]}
                  theme={nivoTheme}
                  groupMode='stacked'
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Distribución por Cuenta</CardTitle>
              </CardHeader>
              <CardContent style={{ height: 300 }}>
                <ResponsivePie data={filteredPieData} margin={{ top: 30, right: 30, bottom: 50, left: 60 }} innerRadius={0.5} padAngle={0.7} cornerRadius={3} activeOuterRadiusOffset={8} borderWidth={1} borderColor={{ from: 'color', modifiers: [['darker', 0.2]] }} arcLinkLabelsSkipAngle={10} arcLinkLabelsTextColor={theme === 'dark' ? '#e5e7eb' : '#222'} arcLinkLabelsThickness={2} arcLinkLabelsColor={{ from: 'color' }} arcLabelsSkipAngle={10} arcLabelsTextColor={{ from: 'color', modifiers: [['darker', 2]] }} theme={nivoTheme} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Radar de Categorías</CardTitle>
              </CardHeader>
              <CardContent style={{ height: 300 }}>
                <ResponsiveRadar data={filteredRadarData} keys={['Gastos', 'Ingresos']} indexBy='categoria' maxValue='auto' margin={{ top: 30, right: 30, bottom: 50, left: 60 }} curve='linearClosed' borderWidth={2} borderColor={{ from: 'color' }} gridLevels={5} gridShape='circular' gridLabelOffset={36} enableDots={true} dotSize={8} dotColor={{ theme: 'background' }} dotBorderWidth={2} dotBorderColor={{ from: 'color' }} enableDotLabel={true} dotLabel='value' dotLabelYOffset={-12} colors={{ scheme: 'nivo' }} fillOpacity={0.25} blendMode='multiply' animate={true} isInteractive={true} theme={nivoTheme} />
              </CardContent>
            </Card>
            <Card className='md:col-span-2'>
              <CardHeader>
                <CardTitle>Mapa de Calor Semanal</CardTitle>
              </CardHeader>
              <CardContent style={{ height: 300 }}>
                <ResponsiveHeatMap
                  data={filteredHeatData}
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