'use client'

import { ChevronLeft, ChevronRight, Copy, Download, SlidersHorizontal } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import type { DateRange as PickerRange } from 'react-day-picker'
import { toast } from 'sonner'
import { CalendarDateRangePicker } from '@/components/date-range-picker'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useGetAccounts } from '@/hooks/queries/useAccountsQuery'
import {
	type AnalysisPeriod,
	canStepForward,
	fromApiDate,
	type PeriodMode,
	resolvePeriod,
	stepPeriod,
	toApiDate,
} from '@/lib/analysisReport'
import { formatLocalDate, useAppLocale } from '@/lib/i18n/date-locale'
import { cn } from '@/lib/utils'
import { buildExportSnapshot } from './analysis-export'
import { capitalize } from './report-format'
import { useAnalysisReport } from './useAnalysisReport'
import { type AnalysisUrlState, useAnalysisUrlState } from './useAnalysisUrlState'

const MODES: PeriodMode[] = ['month', 'year', 'range']
const MODE_KEY = { month: 'modeMonth', year: 'modeYear', range: 'modeRange' } as const

/** The period a mode switch lands on, keeping the user near what they were looking at. */
export function switchPeriodMode(period: AnalysisPeriod, mode: PeriodMode, today: Date): AnalysisPeriod {
	if (period.mode === mode) return period
	const resolved = resolvePeriod(period, today)
	const end = resolved.range.to
	if (mode === 'month') return { mode: 'month', year: end.getFullYear(), month: end.getMonth() + 1 }
	if (mode === 'year') return { mode: 'year', year: end.getFullYear() }
	return { mode: 'range', from: toApiDate(resolved.range.from), to: toApiDate(end) }
}

function PeriodStepper({ state, className }: { state: AnalysisUrlState; className?: string }) {
	const t = useTranslations('analysis')
	const locale = useAppLocale()
	const { period, today, setPeriod } = state
	const [draft, setDraft] = useState<PickerRange | undefined>()

	if (period.mode === 'range') {
		const value = draft ?? {
			from: fromApiDate(period.from) ?? undefined,
			to: fromApiDate(period.to) ?? undefined,
		}
		return (
			<CalendarDateRangePicker
				className={className}
				value={value}
				onChange={(range) => {
					if (range?.from && range.to) {
						setDraft(undefined)
						setPeriod({ mode: 'range', from: toApiDate(range.from), to: toApiDate(range.to) })
					} else {
						setDraft(range)
					}
				}}
			/>
		)
	}

	const isMonth = period.mode === 'month'
	const label = isMonth
		? capitalize(
				formatLocalDate(new Date(period.year, period.month - 1, 1), locale, { month: 'long', year: 'numeric' }),
				locale,
			)
		: String(period.year)

	return (
		<fieldset
			aria-label={t('periodGroup')}
			className={cn(
				'm-0 flex h-10 min-w-0 items-center justify-between rounded-md border border-input bg-background p-0',
				className,
			)}
		>
			<Button
				type='button'
				variant='ghost'
				size='icon'
				className='h-[38px] rounded-r-none'
				aria-label={isMonth ? t('previousMonth') : t('previousYear')}
				onClick={() => setPeriod(stepPeriod(period, -1))}
			>
				<ChevronLeft className='h-4 w-4' aria-hidden='true' />
			</Button>
			<span className='min-w-[8.5rem] px-1 text-center text-sm font-semibold tabular-nums' aria-live='polite'>
				{label}
			</span>
			<Button
				type='button'
				variant='ghost'
				size='icon'
				className='h-[38px] rounded-l-none'
				aria-label={isMonth ? t('nextMonth') : t('nextYear')}
				disabled={!canStepForward(period, today)}
				onClick={() => setPeriod(stepPeriod(period, 1))}
			>
				<ChevronRight className='h-4 w-4' aria-hidden='true' />
			</Button>
		</fieldset>
	)
}

function ModeToggle({ state, className }: { state: AnalysisUrlState; className?: string }) {
	const t = useTranslations('analysis')
	const { period, today, setPeriod } = state
	return (
		<fieldset
			aria-label={t('periodMode')}
			className={cn('m-0 flex min-w-0 gap-0.5 rounded-md border-0 bg-muted p-[3px]', className)}
		>
			{MODES.map((mode) => {
				const active = period.mode === mode
				return (
					<button
						key={mode}
						type='button'
						aria-pressed={active}
						onClick={() => setPeriod(switchPeriodMode(period, mode, today))}
						className={cn(
							'h-10 flex-1 rounded-sm px-3 sm:h-[34px] text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
							active ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
						)}
					>
						{t(MODE_KEY[mode])}
					</button>
				)
			})}
		</fieldset>
	)
}

function AccountSelect({ state, className }: { state: AnalysisUrlState; className?: string }) {
	const t = useTranslations('analysis')
	const { data: accounts = [] } = useGetAccounts()
	return (
		<Select value={state.accountId ?? 'all'} onValueChange={(value) => state.setAccount(value)}>
			<SelectTrigger aria-label={t('account')} className={cn('sm:w-auto sm:min-w-[11rem]', className)}>
				<SelectValue placeholder={t('allAccounts')} />
			</SelectTrigger>
			<SelectContent>
				<SelectItem value='all'>{t('allAccounts')}</SelectItem>
				{accounts.map((account) => (
					<SelectItem key={account.id} value={account.id}>
						{account.name}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	)
}

/** Copy/download of the report snapshot (rounded to cents). */
function useExport(state: AnalysisUrlState) {
	const t = useTranslations('analysis')
	const { report } = useAnalysisReport(state.period, state.today, state.accountId)
	const snapshotText = () => (report ? JSON.stringify(buildExportSnapshot(report, state.accountId), null, 2) : '')

	const download = () => {
		const text = snapshotText()
		if (!text) return
		const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
		const link = document.createElement('a')
		link.href = url
		link.download = `analytics-${toApiDate(state.today)}.json`
		link.click()
		URL.revokeObjectURL(url)
		toast.success(t('exportDownloaded'))
	}

	const copy = async () => {
		try {
			await navigator.clipboard.writeText(snapshotText())
			toast.success(t('exportCopied'))
		} catch {
			toast.error(t('exportCopyError'))
		}
	}

	return { ready: report !== null, download, copy }
}

function ExportMenu({ state }: { state: AnalysisUrlState }) {
	const t = useTranslations('analysis')
	const { ready, download, copy } = useExport(state)
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button type='button' variant='outline' disabled={!ready}>
					<Download className='mr-2 h-4 w-4' aria-hidden='true' />
					{t('export')}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align='end'>
				<DropdownMenuItem onSelect={download}>
					<Download className='mr-2 h-4 w-4' aria-hidden='true' />
					{t('exportDownload')}
				</DropdownMenuItem>
				<DropdownMenuItem onSelect={() => void copy()}>
					<Copy className='mr-2 h-4 w-4' aria-hidden='true' />
					{t('exportCopy')}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	)
}

/** Below `sm`: mode, account and export in a bottom drawer next to the period stepper. */
function MobileOptions({ state }: { state: AnalysisUrlState }) {
	const t = useTranslations('analysis')
	const [open, setOpen] = useState(false)
	const { ready, download, copy } = useExport(state)
	return (
		<>
			<Button
				type='button'
				variant='outline'
				size='icon'
				className='shrink-0'
				aria-label={t('moreOptions')}
				onClick={() => setOpen(true)}
			>
				<SlidersHorizontal className='h-4 w-4' aria-hidden='true' />
			</Button>
			<Drawer open={open} onOpenChange={setOpen} shouldScaleBackground={false}>
				<DrawerContent aria-describedby={undefined}>
					<DrawerHeader className='text-left'>
						<DrawerTitle>{t('optionsTitle')}</DrawerTitle>
					</DrawerHeader>
					<div className='flex flex-col gap-3 px-4 pb-6'>
						<ModeToggle state={state} />
						<AccountSelect state={state} />
						<div className='grid grid-cols-2 gap-2'>
							<Button type='button' variant='outline' disabled={!ready} onClick={download}>
								<Download className='mr-2 h-4 w-4' aria-hidden='true' />
								{t('exportDownload')}
							</Button>
							<Button type='button' variant='outline' disabled={!ready} onClick={() => void copy()}>
								<Copy className='mr-2 h-4 w-4' aria-hidden='true' />
								{t('exportCopy')}
							</Button>
						</div>
					</div>
				</DrawerContent>
			</Drawer>
		</>
	)
}

/** Header controls of the report: period (month/year/range), account and export. */
export function AnalysisActions() {
	const state = useAnalysisUrlState()
	return (
		<>
			<div className='flex gap-2 sm:hidden'>
				<PeriodStepper state={state} className='min-w-0 flex-1' />
				<MobileOptions state={state} />
			</div>
			<div className='hidden flex-wrap items-center justify-end gap-2 sm:flex'>
				<PeriodStepper state={state} />
				<ModeToggle state={state} />
				<AccountSelect state={state} />
				<ExportMenu state={state} />
			</div>
		</>
	)
}
