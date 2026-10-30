'use client'

import { ChevronDown, FileText, Filter, Lightbulb, Link2, PiggyBank, Plus, Sparkles } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { ComponentProps, useCallback, useEffect, useId, useRef, useState } from 'react'
import { ReconciliationModal, SavingsPlanModal, SpendingInsightsModal } from '@/components/ai'
import { AIExtractionModal } from '@/components/ai/AIExtractionModal'
import { CalendarDateRangePicker } from '@/components/date-range-picker'
import TransactionFormModal from '@/components/transactions/TransactionFormModal'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useGetAccounts } from '@/hooks/queries/useAccountsQuery'
import { useGetCategories } from '@/hooks/queries/useCategoriesQuery'
import { useFeatureFlags } from '@/hooks/useFeatureFlags'
import { useTransactionContext } from './TransactionContext'

/** Typing in the free-text filters only queries the API after this pause. */
const FILTER_INPUT_DEBOUNCE_MS = 300

type DebouncedInputProps = Omit<ComponentProps<typeof Input>, 'value' | 'onChange'> & {
	value: string
	onCommit: (_value: string) => void
	delay?: number
}

/**
 * Text input that keeps keystrokes local and commits the value after `delay` ms
 * without typing (or when it unmounts, e.g. the drawer closes mid-typing).
 * External changes to `value` (clear filters) replace the draft.
 */
function DebouncedInput({ value, onCommit, delay = FILTER_INPUT_DEBOUNCE_MS, ...props }: DebouncedInputProps) {
	const [draft, setDraft] = useState(value)
	const committedRef = useRef(value)
	const draftRef = useRef(value)
	const onCommitRef = useRef(onCommit)

	useEffect(() => {
		onCommitRef.current = onCommit
	}, [onCommit])

	const commit = useCallback((next: string) => {
		if (next === committedRef.current) return
		committedRef.current = next
		onCommitRef.current(next)
	}, [])

	useEffect(() => {
		if (value === committedRef.current) return
		committedRef.current = value
		draftRef.current = value
		setDraft(value)
	}, [value])

	useEffect(() => {
		if (draft === committedRef.current) return
		const timeout = setTimeout(() => commit(draft), delay)
		return () => clearTimeout(timeout)
	}, [draft, delay, commit])

	// Flush a pending value on unmount.
	useEffect(() => () => commit(draftRef.current), [commit])

	return (
		<Input
			{...props}
			value={draft}
			onChange={(event) => {
				draftRef.current = event.target.value
				setDraft(event.target.value)
			}}
		/>
	)
}

/**
 * Page-level actions of the transaction history: AI tools (one menu), the
 * filter drawer and the primary "New transaction" button, plus the modals they
 * open. Rendered in the page header's actions slot.
 */
export function TransactionActions() {
	const t = useTranslations('transactions')
	const tForms = useTranslations('forms')
	const tAI = useTranslations('ai.common')
	const fieldId = useId()
	const [drawerOpen, setDrawerOpen] = useState(false)
	const [insightsOpen, setInsightsOpen] = useState(false)
	const [extractionOpen, setExtractionOpen] = useState(false)
	const [reconciliationOpen, setReconciliationOpen] = useState(false)
	const [savingsPlanOpen, setSavingsPlanOpen] = useState(false)

	const { filters, setFilters, clearFilters, createTransaction, isModalOpen, setModalOpen, setEditingTransaction } =
		useTransactionContext()
	const { data: accounts = [] } = useGetAccounts()
	const { data: categories = [] } = useGetCategories()
	const { isEnabled } = useFeatureFlags()

	const canUseExtraction = isEnabled('ai_extraction')
	const canUseReconciliation = isEnabled('ai_reconciliation')
	const canUseSavingsPlan = isEnabled('ai_savings_plan')
	const hasAITools = canUseExtraction || canUseReconciliation || canUseSavingsPlan

	const ids = {
		type: `${fieldId}-type`,
		account: `${fieldId}-account`,
		category: `${fieldId}-category`,
		minAmount: `${fieldId}-min`,
		maxAmount: `${fieldId}-max`,
		search: `${fieldId}-search`,
		dateRange: `${fieldId}-range`,
	}

	return (
		// A fragment, not a wrapper: PageHeader lays out its direct children (full width below sm).
		<>
			{hasAITools && (
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant='outline' aria-label={t('aiTools')}>
							<Sparkles className='h-4 w-4 sm:mr-2' aria-hidden='true' />
							<span className='hidden sm:inline'>{t('aiTools')}</span>
							<ChevronDown className='ml-1 hidden h-4 w-4 opacity-60 sm:inline' aria-hidden='true' />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align='end' className='w-56'>
						{canUseExtraction && (
							<DropdownMenuItem onSelect={() => setInsightsOpen(true)}>
								<Lightbulb className='mr-2 h-4 w-4' aria-hidden='true' />
								{tAI('insights')}
							</DropdownMenuItem>
						)}
						{canUseExtraction && (
							<DropdownMenuItem onSelect={() => setExtractionOpen(true)}>
								<FileText className='mr-2 h-4 w-4' aria-hidden='true' />
								{tAI('extractFromDocument')}
							</DropdownMenuItem>
						)}
						{canUseReconciliation && (
							<DropdownMenuItem onSelect={() => setReconciliationOpen(true)}>
								<Link2 className='mr-2 h-4 w-4' aria-hidden='true' />
								{tAI('reconcile')}
							</DropdownMenuItem>
						)}
						{canUseSavingsPlan && (
							<DropdownMenuItem onSelect={() => setSavingsPlanOpen(true)}>
								<PiggyBank className='mr-2 h-4 w-4' aria-hidden='true' />
								{tAI('savingsPlan')}
							</DropdownMenuItem>
						)}
					</DropdownMenuContent>
				</DropdownMenu>
			)}
			<Button variant='outline' aria-label={t('filters')} onClick={() => setDrawerOpen(true)}>
				<Filter className='h-4 w-4 sm:mr-2' aria-hidden='true' />
				<span className='hidden sm:inline'>{t('filters')}</span>
			</Button>
			<Button
				onClick={() => {
					setEditingTransaction(null)
					setModalOpen(true)
				}}
			>
				<Plus className='mr-2 h-4 w-4' aria-hidden='true' />
				{t('addTransaction')}
			</Button>

			{canUseExtraction && <SpendingInsightsModal open={insightsOpen} onOpenChange={setInsightsOpen} />}
			{canUseExtraction && <AIExtractionModal open={extractionOpen} onOpenChange={setExtractionOpen} />}
			{canUseReconciliation && <ReconciliationModal open={reconciliationOpen} onOpenChange={setReconciliationOpen} />}
			{canUseSavingsPlan && <SavingsPlanModal open={savingsPlanOpen} onOpenChange={setSavingsPlanOpen} />}

			<TransactionFormModal open={isModalOpen} setOpen={setModalOpen} createTransaction={createTransaction} />

			<Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
				{/* Filter drawer has no description; opt out explicitly (Radix warns otherwise). */}
				<DrawerContent className='ml-auto h-full w-full max-w-sm' aria-describedby={undefined}>
					<DrawerHeader>
						<DrawerTitle>{t('filterTransactions')}</DrawerTitle>
					</DrawerHeader>
					<div className='space-y-4 overflow-y-auto p-4'>
						<fieldset className='min-w-0'>
							<legend className='mb-2 text-sm font-medium'>{t('dateRange')}</legend>
							<CalendarDateRangePicker
								value={filters.dateRange}
								onChange={(dateRange) => {
									if (dateRange && typeof dateRange === 'object' && 'from' in dateRange && 'to' in dateRange) {
										setFilters((f) => ({ ...f, dateRange }))
									}
								}}
							/>
						</fieldset>
						<div className='space-y-2'>
							<Label htmlFor={ids.type}>{tForms('type')}</Label>
							<Select value={filters.type} onValueChange={(v) => setFilters((f) => ({ ...f, type: v }))}>
								<SelectTrigger id={ids.type}>
									<SelectValue placeholder={t('all')} />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value='all'>{t('all')}</SelectItem>
									<SelectItem value='INCOME'>{t('income')}</SelectItem>
									<SelectItem value='BILL'>{t('expense')}</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<div className='space-y-2'>
							<Label htmlFor={ids.account}>{t('account')}</Label>
							<Select value={filters.account} onValueChange={(v) => setFilters((f) => ({ ...f, account: v }))}>
								<SelectTrigger id={ids.account}>
									<SelectValue placeholder={t('allFemale')} />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value='all'>{t('allFemale')}</SelectItem>
									{accounts.map((acc) => (
										<SelectItem key={acc.id} value={acc.id}>
											{acc.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className='space-y-2'>
							<Label htmlFor={ids.category}>{t('category')}</Label>
							<Select value={filters.category} onValueChange={(v) => setFilters((f) => ({ ...f, category: v }))}>
								<SelectTrigger id={ids.category}>
									<SelectValue placeholder={t('allFemale')} />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value='all'>{t('allFemale')}</SelectItem>
									{categories.map((cat) => (
										<SelectItem key={cat.id} value={cat.id}>
											{cat.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className='grid grid-cols-2 gap-2'>
							<div className='space-y-2'>
								<Label htmlFor={ids.minAmount}>{t('minAmount')}</Label>
								<DebouncedInput
									id={ids.minAmount}
									type='text'
									inputMode='decimal'
									autoComplete='off'
									value={filters.minAmount}
									onCommit={(minAmount) => setFilters((f) => ({ ...f, minAmount }))}
									placeholder='0'
								/>
							</div>
							<div className='space-y-2'>
								<Label htmlFor={ids.maxAmount}>{t('maxAmount')}</Label>
								<DebouncedInput
									id={ids.maxAmount}
									type='text'
									inputMode='decimal'
									autoComplete='off'
									value={filters.maxAmount}
									onCommit={(maxAmount) => setFilters((f) => ({ ...f, maxAmount }))}
									placeholder='99999'
								/>
							</div>
						</div>
						<div className='space-y-2'>
							<Label htmlFor={ids.search}>{t('search')}</Label>
							<DebouncedInput
								id={ids.search}
								type='search'
								value={filters.search}
								onCommit={(search) => setFilters((f) => ({ ...f, search }))}
								placeholder={t('searchPlaceholder')}
							/>
						</div>
						<div className='pt-2'>
							<Button type='button' variant='outline' className='w-full' onClick={() => clearFilters()}>
								{t('clearFilters')}
							</Button>
						</div>
					</div>
				</DrawerContent>
			</Drawer>
		</>
	)
}
