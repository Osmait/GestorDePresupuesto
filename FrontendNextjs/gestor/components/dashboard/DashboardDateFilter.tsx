'use client'

import { format, parse } from 'date-fns'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useTransition } from 'react'
import type { DateRange } from 'react-day-picker'
import { CalendarDateRangePicker } from '@/components/date-range-picker'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type Preset = 'this_month' | 'last_month' | 'last_3_months' | 'this_year' | 'all' | 'custom'

const PRESET_LABEL_KEYS = {
	this_month: 'thisMonth',
	last_month: 'lastMonth',
	last_3_months: 'last3Months',
	this_year: 'thisYear',
	all: 'allTime',
	custom: 'customRange',
} as const satisfies Record<Preset, string>

interface Props {
	initialFrom?: string
	initialTo?: string
	initialPreset?: Preset
}

function computePresetRange(preset: Preset): { from: string; to: string } | null {
	const now = new Date()
	const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1)
	const endOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth() + 1, 0)

	switch (preset) {
		case 'this_month':
			return { from: format(startOfMonth(now), 'yyyy-MM-dd'), to: format(endOfMonth(now), 'yyyy-MM-dd') }
		case 'last_month': {
			const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
			return { from: format(startOfMonth(prev), 'yyyy-MM-dd'), to: format(endOfMonth(prev), 'yyyy-MM-dd') }
		}
		case 'last_3_months': {
			const from = new Date(now.getFullYear(), now.getMonth() - 2, 1)
			return { from: format(from, 'yyyy-MM-dd'), to: format(endOfMonth(now), 'yyyy-MM-dd') }
		}
		case 'this_year':
			return {
				from: format(new Date(now.getFullYear(), 0, 1), 'yyyy-MM-dd'),
				to: format(new Date(now.getFullYear(), 11, 31), 'yyyy-MM-dd'),
			}
		default:
			return null
	}
}

export function DashboardDateFilter({ initialFrom, initialTo, initialPreset = 'this_month' }: Props) {
	const t = useTranslations('dateFilter')
	const router = useRouter()
	const searchParams = useSearchParams()
	const [isPending, startTransition] = useTransition()

	const pushFilter = (next: { from?: string; to?: string; preset: Preset }) => {
		const params = new URLSearchParams(searchParams?.toString())
		if (next.from) params.set('date_from', next.from)
		else params.delete('date_from')
		if (next.to) params.set('date_to', next.to)
		else params.delete('date_to')
		params.set('preset', next.preset)
		startTransition(() => {
			router.replace(`?${params.toString()}`, { scroll: false })
		})
	}

	const handlePresetChange = (preset: Preset) => {
		if (preset === 'all') {
			pushFilter({ preset })
			return
		}
		if (preset === 'custom') {
			pushFilter({ from: initialFrom, to: initialTo, preset })
			return
		}
		const range = computePresetRange(preset)
		if (range) pushFilter({ from: range.from, to: range.to, preset })
	}

	const handleCustomRange = (range: DateRange | undefined) => {
		if (!range?.from) return
		const from = format(range.from, 'yyyy-MM-dd')
		const to = range.to ? format(range.to, 'yyyy-MM-dd') : from
		pushFilter({ from, to, preset: 'custom' })
	}

	const pickerValue: DateRange | undefined =
		initialFrom && initialTo
			? {
					from: parse(initialFrom, 'yyyy-MM-dd', new Date()),
					to: parse(initialTo, 'yyyy-MM-dd', new Date()),
				}
			: undefined

	const clearFilter = () => {
		const params = new URLSearchParams(searchParams?.toString())
		params.delete('date_from')
		params.delete('date_to')
		params.delete('preset')
		startTransition(() => {
			router.replace(`?${params.toString()}`, { scroll: false })
		})
	}

	return (
		<div className='flex flex-wrap items-center gap-2' data-loading={isPending ? 'true' : 'false'}>
			<Select value={initialPreset} onValueChange={(v) => handlePresetChange(v as Preset)}>
				<SelectTrigger className='w-[180px]' aria-label={t('label')}>
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{(Object.keys(PRESET_LABEL_KEYS) as Preset[]).map((preset) => (
						<SelectItem key={preset} value={preset}>
							{t(PRESET_LABEL_KEYS[preset])}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			{initialPreset === 'custom' && <CalendarDateRangePicker value={pickerValue} onChange={handleCustomRange} />}
			{initialPreset !== 'this_month' && (
				<Button variant='ghost' size='sm' onClick={clearFilter}>
					{t('reset')}
				</Button>
			)}
		</div>
	)
}
