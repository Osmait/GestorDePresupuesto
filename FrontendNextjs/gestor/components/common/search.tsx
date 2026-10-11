'use client'

import {
	ArrowUpDown,
	Building2,
	CreditCard,
	HandCoins,
	Loader2,
	type LucideIcon,
	PiggyBank,
	Search as SearchIcon,
	Tags,
	X,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import * as React from 'react'
import { Amount } from '@/components/shared/Amount'
import { EmptyState } from '@/components/shared/EmptyState'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useSearchQuery } from '@/hooks/queries/useSearchQuery'
import { cn } from '@/lib/utils'

interface SearchOption {
	/** Stable DOM id, used by aria-activedescendant. */
	id: string
	path: string
	primary: React.ReactNode
	/** Right-aligned detail: amount or bank badge. */
	trailing?: React.ReactNode
	leading?: React.ReactNode
}

interface SearchGroup {
	key: string
	label: string
	icon: LucideIcon
	options: SearchOption[]
}

type Translate = ReturnType<typeof useTranslations<'search'>>

const INCOME_TYPES = new Set(['income', 'loan_collection'])

/** Turns the search API response into ordered, navigable groups. */
function buildGroups(data: any, t: Translate, prefix: string): SearchGroup[] {
	if (!data) return []
	const groups: SearchGroup[] = []
	const option = (group: string, key: string | number, rest: Omit<SearchOption, 'id'>): SearchOption => ({
		id: `${prefix}-${group}-${key}`,
		...rest,
	})

	if (data.transactions?.length) {
		groups.push({
			key: 'transactions',
			label: t('transactions'),
			icon: ArrowUpDown,
			options: data.transactions.map((tx: any) =>
				option('tx', tx.id, {
					path: `/app/transactions?highlight=${tx.id}&open=details`,
					primary: tx.name || tx.description,
					trailing:
						tx.amount !== undefined && tx.amount !== null ? (
							<Amount
								className='text-xs'
								value={INCOME_TYPES.has(tx.type_transation) ? Math.abs(tx.amount) : -Math.abs(tx.amount)}
								currency={tx.currency}
								tone='auto'
								signed
							/>
						) : null,
				}),
			),
		})
	}

	if (data.accounts?.length) {
		groups.push({
			key: 'accounts',
			label: t('accounts'),
			icon: CreditCard,
			options: data.accounts.map((acc: any) =>
				option('account', acc.id, {
					path: `/app/accounts/${acc.id}`,
					primary: acc.name,
					trailing: acc.bank ? (
						<Badge variant='outline' className='h-5 text-xs font-normal'>
							{acc.bank}
						</Badge>
					) : null,
				}),
			),
		})
	}

	if (data.categories?.length) {
		groups.push({
			key: 'categories',
			label: t('categories'),
			icon: Tags,
			options: data.categories.map((cat: any) =>
				option('category', cat.id, {
					path: `/app/category?selected=${cat.id}`,
					primary: cat.name,
					leading: cat.icon ? <span aria-hidden='true'>{cat.icon}</span> : null,
				}),
			),
		})
	}

	if (data.budgets?.length) {
		groups.push({
			key: 'budgets',
			label: t('budgets'),
			icon: PiggyBank,
			options: data.budgets.map((bud: any) =>
				option('budget', bud.id, {
					path: `/app/budget?selected=${bud.id}`,
					primary: bud.category_name || t('budget'),
					trailing: <Amount className='text-xs' value={Number(bud.amount ?? 0)} />,
				}),
			),
		})
	}

	if (data.loans?.length) {
		groups.push({
			key: 'loans',
			label: t('loans'),
			icon: HandCoins,
			options: data.loans.map((loan: any) => {
				const id = loan.id || loan.Id
				const amount = loan.pending_amount ?? loan.PendingAmount ?? loan.total_amount ?? loan.TotalAmount
				return option('loan', id, {
					path: `/app/loans?selected=${id}&open=details`,
					primary: loan.borrower_name || loan.BorrowerName || t('loan'),
					trailing: <Amount className='text-xs' value={Number(amount ?? 0)} currency={loan.currency} />,
				})
			}),
		})
	}

	if (data.certificates?.length) {
		groups.push({
			key: 'certificates',
			label: t('certificates'),
			icon: Building2,
			options: data.certificates.map((certificate: any) =>
				option('certificate', certificate.id, {
					path: `/app/certificates?selected=${certificate.id}&open=history`,
					primary: certificate.bank || t('certificate'),
					trailing: (
						<Amount className='text-xs' value={Number(certificate.base_capital ?? 0)} currency={certificate.currency} />
					),
				}),
			),
		})
	}

	return groups
}

/**
 * Combobox state shared by the desktop dropdown and the mobile dialog: the
 * input owns focus, Arrow keys move the active option, Enter opens it and
 * Escape closes the results (WAI-ARIA combobox with a listbox popup).
 */
function useSearchListbox(groups: SearchGroup[], onSelect: (path: string) => void, onEscape: () => void) {
	const options = React.useMemo(() => groups.flatMap((group) => group.options), [groups])
	const [activeIndex, setActiveIndex] = React.useState(-1)

	// A new result set starts with nothing highlighted (keyed on ids, not object identity).
	const signature = options.map((option) => option.id).join('|')
	// biome-ignore lint/correctness/useExhaustiveDependencies: reset only when the set of results changes
	React.useEffect(() => setActiveIndex(-1), [signature])

	const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
		if (event.key === 'ArrowDown' && options.length > 0) {
			event.preventDefault()
			setActiveIndex((index) => (index + 1) % options.length)
		} else if (event.key === 'ArrowUp' && options.length > 0) {
			event.preventDefault()
			setActiveIndex((index) => (index <= 0 ? options.length - 1 : index - 1))
		} else if (event.key === 'Enter' && activeIndex >= 0 && options[activeIndex]) {
			event.preventDefault()
			onSelect(options[activeIndex].path)
		} else if (event.key === 'Escape') {
			onEscape()
		}
	}

	const activeId = activeIndex >= 0 ? options[activeIndex]?.id : undefined

	// Keep the highlighted option visible while moving with the keyboard.
	React.useEffect(() => {
		if (activeId) document.getElementById(activeId)?.scrollIntoView?.({ block: 'nearest' })
	}, [activeId])

	return { activeId, setActiveIndex, options, onKeyDown }
}

function SearchResults({
	listId,
	groups,
	isLoading,
	activeId,
	onSelect,
	onHover,
}: {
	listId: string
	groups: SearchGroup[]
	isLoading: boolean
	activeId?: string
	onSelect: (path: string) => void
	onHover: (id: string) => void
}) {
	const t = useTranslations('search')

	if (isLoading) {
		return (
			<div role='status' className='flex items-center justify-center p-4 text-sm text-muted-foreground'>
				<Loader2 className='mr-2 h-4 w-4 animate-spin' aria-hidden='true' /> {t('searching')}
			</div>
		)
	}

	if (groups.length === 0) {
		return (
			<div role='status'>
				<EmptyState compact icon={SearchIcon} title={t('noResults')} />
			</div>
		)
	}

	return (
		<div id={listId} role='listbox' aria-label={t('resultsLabel')} className='py-2'>
			{groups.map((group, groupIndex) => {
				const Icon = group.icon
				const headingId = `${listId}-${group.key}`
				return (
					// biome-ignore lint/a11y/useSemanticElements: a listbox option group; <fieldset> is for form controls
					<div key={group.key} role='group' aria-labelledby={headingId} className='px-2 py-1'>
						{groupIndex > 0 && <div className='mx-2 mb-2 h-px bg-border' aria-hidden='true' />}
						<div id={headingId} className='mb-1 flex items-center px-2 text-xs font-semibold text-muted-foreground'>
							<Icon className='mr-2 h-3 w-3' aria-hidden='true' /> {group.label}
						</div>
						{group.options.map((option) => {
							const active = option.id === activeId
							return (
								<div
									key={option.id}
									id={option.id}
									role='option'
									aria-selected={active}
									tabIndex={-1}
									// Keep focus in the input so typing and arrow keys keep working.
									onMouseDown={(event) => event.preventDefault()}
									onMouseMove={() => onHover(option.id)}
									onClick={() => onSelect(option.path)}
									onKeyDown={(event) => {
										if (event.key === 'Enter') onSelect(option.path)
									}}
									className={cn(
										'flex min-h-10 cursor-pointer items-center justify-between gap-3 rounded-md px-2 py-2 text-sm transition-colors',
										active && 'bg-accent text-accent-foreground',
									)}
								>
									<span className='flex min-w-0 flex-1 items-center gap-2'>
										{option.leading}
										<span className='truncate'>{option.primary}</span>
									</span>
									{option.trailing ? <span className='shrink-0'>{option.trailing}</span> : null}
								</div>
							)
						})}
					</div>
				)
			})}
		</div>
	)
}

export function Search() {
	const t = useTranslations('search')
	const [query, setQuery] = React.useState('')
	const [debouncedQuery, setDebouncedQuery] = React.useState('')
	const [open, setOpen] = React.useState(false)
	const [mobileOpen, setMobileOpen] = React.useState(false)
	const router = useRouter()
	const searchRef = React.useRef<HTMLDivElement>(null)
	const mobileInputRef = React.useRef<HTMLInputElement>(null)
	const baseId = React.useId()
	const desktopListId = `${baseId}-desktop`
	const mobileListId = `${baseId}-mobile`

	// Debounce logic
	React.useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedQuery(query)
		}, 500)
		return () => clearTimeout(timer)
	}, [query])

	// Fetch data
	const { data, isLoading } = useSearchQuery(debouncedQuery)

	// Close on click outside (desktop only)
	React.useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
				setOpen(false)
			}
		}
		document.addEventListener('mousedown', handleClickOutside)
		return () => {
			document.removeEventListener('mousedown', handleClickOutside)
		}
	}, [])

	// Focus mobile input when modal opens
	React.useEffect(() => {
		if (mobileOpen && mobileInputRef.current) {
			setTimeout(() => mobileInputRef.current?.focus(), 100)
		}
	}, [mobileOpen])

	const handleSelect = (path: string) => {
		setOpen(false)
		setMobileOpen(false)
		setQuery('')
		router.push(path)
	}

	const handleMobileClose = () => {
		setMobileOpen(false)
		setQuery('')
	}

	const desktopGroups = React.useMemo(() => buildGroups(data, t, desktopListId), [data, t, desktopListId])
	const mobileGroups = React.useMemo(() => buildGroups(data, t, mobileListId), [data, t, mobileListId])

	const desktopOpen = open && debouncedQuery.length > 0
	const desktop = useSearchListbox(desktopGroups, handleSelect, () => setOpen(false))
	// Escape inside the dialog closes the dialog itself (Radix), so nothing extra here.
	const mobile = useSearchListbox(mobileGroups, handleSelect, () => {})

	const hoverHandler = (listbox: ReturnType<typeof useSearchListbox>) => (id: string) =>
		listbox.setActiveIndex(listbox.options.findIndex((option) => option.id === id))

	return (
		<>
			{/* Mobile: Icon button that opens fullscreen modal */}
			<Button
				variant='ghost'
				size='icon'
				className='md:hidden'
				aria-label={t('open')}
				onClick={() => setMobileOpen(true)}
			>
				<SearchIcon className='h-4 w-4' aria-hidden='true' />
			</Button>

			{/* Mobile: Fullscreen Search Modal */}
			<Dialog open={mobileOpen} onOpenChange={(next) => (next ? setMobileOpen(true) : handleMobileClose())}>
				<DialogContent
					aria-describedby={undefined}
					className='h-[100dvh] max-h-[100dvh] w-full gap-0 p-0 sm:max-w-full [&>button]:hidden'
				>
					<DialogTitle className='sr-only'>{t('inputLabel')}</DialogTitle>
					<div className='flex h-full flex-col'>
						{/* Header with search input */}
						<div className='sticky top-0 flex items-center gap-2 border-b bg-background p-3'>
							<div className='relative flex-1'>
								<SearchIcon
									className='pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground'
									aria-hidden='true'
								/>
								<Input
									ref={mobileInputRef}
									type='search'
									role='combobox'
									aria-label={t('inputLabel')}
									aria-expanded={debouncedQuery.length > 0}
									aria-controls={mobileListId}
									aria-autocomplete='list'
									aria-activedescendant={mobile.activeId}
									placeholder={t('placeholderLong')}
									className='h-10 pl-9'
									value={query}
									onChange={(e) => setQuery(e.target.value)}
									onKeyDown={mobile.onKeyDown}
									autoFocus
								/>
							</div>
							<Button
								variant='ghost'
								size='icon'
								onClick={handleMobileClose}
								className='shrink-0'
								aria-label={t('close')}
							>
								<X className='h-4 w-4' aria-hidden='true' />
							</Button>
						</div>

						{/* Results area */}
						<div className='flex-1 overflow-y-auto'>
							{debouncedQuery.length > 0 ? (
								<SearchResults
									listId={mobileListId}
									groups={mobileGroups}
									isLoading={isLoading}
									activeId={mobile.activeId}
									onSelect={handleSelect}
									onHover={hoverHandler(mobile)}
								/>
							) : (
								<EmptyState compact icon={SearchIcon} title={t('hint')} className='py-12' />
							)}
						</div>
					</div>
				</DialogContent>
			</Dialog>

			{/* Desktop: Inline search with dropdown */}
			<div ref={searchRef} className='relative hidden md:block md:w-56 lg:w-[300px]'>
				<SearchIcon
					className='pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground'
					aria-hidden='true'
				/>
				<Input
					type='search'
					role='combobox'
					aria-label={t('inputLabel')}
					aria-expanded={desktopOpen}
					aria-controls={desktopOpen ? desktopListId : undefined}
					aria-autocomplete='list'
					aria-activedescendant={desktopOpen ? desktop.activeId : undefined}
					placeholder={t('placeholder')}
					className='w-full pl-8 pr-4'
					value={query}
					onChange={(e) => {
						setQuery(e.target.value)
						setOpen(true)
					}}
					onFocus={() => {
						if (query.length > 0) setOpen(true)
					}}
					onKeyDown={(event) => {
						if (!desktopOpen && event.key === 'ArrowDown' && query.length > 0) setOpen(true)
						desktop.onKeyDown(event)
					}}
				/>

				{desktopOpen && (
					<div className='absolute top-full right-0 z-[100] mt-2 max-h-[400px] w-[320px] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-lg'>
						<SearchResults
							listId={desktopListId}
							groups={desktopGroups}
							isLoading={isLoading}
							activeId={desktop.activeId}
							onSelect={handleSelect}
							onHover={hoverHandler(desktop)}
						/>
					</div>
				)}
			</div>
		</>
	)
}
