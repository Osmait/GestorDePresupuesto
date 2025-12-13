'use client'

import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { CalendarDateRangePicker } from '@/components/date-range-picker'
import { Account } from '@/types/account'
import { Category } from '@/types/category'
import { AnalysisFiltersState } from './AnalysisContext'

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
const minYear = 2022
const maxYear = now.getFullYear() + 1
const years = Array.from({ length: maxYear - minYear + 1 }, (_, i) => {
    const y = String(minYear + i)
    return { value: y, label: y }
})

export function AnalysisFiltersForm({ filters, setFilters, accounts, categories }: {
    filters: AnalysisFiltersState
    setFilters: React.Dispatch<React.SetStateAction<AnalysisFiltersState>>
    accounts: Account[]
    categories: Category[]
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
