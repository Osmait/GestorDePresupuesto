'use client'

import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { CalendarDateRangePicker } from '@/components/date-range-picker'
import { Account } from '@/types/account'
import { Category } from '@/types/category'
import { AnalysisFiltersState } from './AnalysisContext'
import { useTranslations } from 'next-intl'

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
    const t = useTranslations('analysis')

    const typeOptions = [
        { value: 'INCOME', label: t('income') },
        { value: 'BILL', label: t('expense') },
    ]

    const months = [
        { value: 'all', label: t('allMonths') },
        { value: '01', label: t('january') },
        { value: '02', label: t('february') },
        { value: '03', label: t('march') },
        { value: '04', label: t('april') },
        { value: '05', label: t('may') },
        { value: '06', label: t('june') },
        { value: '07', label: t('july') },
        { value: '08', label: t('august') },
        { value: '09', label: t('september') },
        { value: '10', label: t('october') },
        { value: '11', label: t('november') },
        { value: '12', label: t('december') },
    ]

    return (
        <form className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8'>
            <div className='md:col-span-2 lg:col-span-3 flex flex-col gap-2'>
                <Label>{t('dateFilterMode')}</Label>
                <div className='flex gap-2'>
                    <Button
                        type='button'
                        variant={filters.filterMode === 'month' ? 'default' : 'outline'}
                        onClick={() => setFilters(f => ({ ...f, filterMode: 'month', dateRange: { from: undefined, to: undefined } }))}
                    >
                        {t('monthYear')}
                    </Button>
                    <Button
                        type='button'
                        variant={filters.filterMode === 'range' ? 'default' : 'outline'}
                        onClick={() => setFilters(f => ({ ...f, filterMode: 'range', month: 'all', year: '' }))}
                    >
                        {t('dateRange')}
                    </Button>
                </div>
            </div>
            {filters.filterMode === 'month' && (
                <>
                    <div>
                        <Label htmlFor='month'>{t('month')}</Label>
                        <Select value={filters.month} onValueChange={v => setFilters(f => ({ ...f, month: v }))}>
                            <SelectTrigger id='month' className='w-full'>
                                <SelectValue placeholder={t('selectMonth')} />
                            </SelectTrigger>
                            <SelectContent>
                                {months.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div>
                        <Label htmlFor='year'>{t('year')}</Label>
                        <Select value={filters.year} onValueChange={v => setFilters(f => ({ ...f, year: v }))}>
                            <SelectTrigger id='year' className='w-full'>
                                <SelectValue placeholder={t('selectYear')} />
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
                    <Label>{t('dateRange')}</Label>
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
                <Label htmlFor='account'>{t('account')}</Label>
                <Select value={filters.account} onValueChange={v => setFilters(f => ({ ...f, account: v }))}>
                    <SelectTrigger id='account' className='w-full'>
                        <SelectValue placeholder={t('allAccounts')} />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value='all'>{t('all')}</SelectItem>
                        {accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
            <div>
                <Label htmlFor='category'>{t('category')}</Label>
                <Select value={filters.category} onValueChange={v => setFilters(f => ({ ...f, category: v }))}>
                    <SelectTrigger id='category' className='w-full'>
                        <SelectValue placeholder={t('allCategories')} />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value='all'>{t('all')}</SelectItem>
                        {categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
            <div>
                <Label htmlFor='type'>{t('type')}</Label>
                <Select value={filters.type} onValueChange={v => setFilters(f => ({ ...f, type: v }))}>
                    <SelectTrigger id='type' className='w-full'>
                        <SelectValue placeholder={t('allTypes')} />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value='all'>{t('all')}</SelectItem>
                        {typeOptions.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
            <div>
                <Label htmlFor='minAmount'>{t('minAmount')}</Label>
                <Input id='minAmount' type='number' value={filters.minAmount} onChange={e => setFilters(f => ({ ...f, minAmount: e.target.value }))} placeholder='0' min={0} className='w-full' />
            </div>
            <div>
                <Label htmlFor='maxAmount'>{t('maxAmount')}</Label>
                <Input id='maxAmount' type='number' value={filters.maxAmount} onChange={e => setFilters(f => ({ ...f, maxAmount: e.target.value }))} placeholder='99999' min={0} className='w-full' />
            </div>
            <div className='md:col-span-2 lg:col-span-3'>
                <Label htmlFor='search'>{t('searchLabel')}</Label>
                <Input id='search' type='text' value={filters.search} onChange={e => setFilters(f => ({ ...f, search: e.target.value }))} placeholder={t('searchPlaceholder')} className='w-full' />
            </div>
        </form>
    )
}

