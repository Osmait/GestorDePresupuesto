'use client'

import { Search } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useId, useMemo, useState } from 'react'
import { Amount } from '@/components/shared/Amount'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { formatLocalDate, useAppLocale } from '@/lib/i18n/date-locale'
import {
	daysInMonth,
	effectiveDay,
	groupPlanItems,
	LEDGER_GROUP_BY,
	type LedgerGroup,
	type LedgerGroupBy,
	matchesSearch,
	normalizeSearch,
	PLAN_CURRENCY,
	type PlanDate,
	sumActiveDop,
	weekOfDay,
} from '@/lib/monthlyPlanUtils'
import { cn } from '@/lib/utils'
import type { Category } from '@/types/category'
import { MonthlyPlanItem } from '@/types/monthlyPlan'
import { LEDGER_ROW_GRID, LEDGER_ROW_INSET, MonthlyPlanItemRow } from './MonthlyPlanItemRow'
import { MonthlyPlanLedgerGroup } from './MonthlyPlanLedgerGroup'
import { useLedgerPreferences } from './useLedgerPreferences'

const CHART_SERIES = 8
const NEUTRAL_COLOR = 'var(--color-muted-foreground)'

const GROUP_BY_LABEL = {
	category: 'groupByCategory',
	week: 'groupByWeek',
	none: 'groupByNone',
} as const satisfies Record<LedgerGroupBy, string>

interface MonthlyPlanLedgerProps {
	items: MonthlyPlanItem[]
	categories: Category[]
	/** The user's local date: drives the weeks, day clamping and "This week". */
	today: PlanDate
	onEdit: (_item: MonthlyPlanItem) => void
	onToggle: (_item: MonthlyPlanItem) => void
	onDelete: (_item: MonthlyPlanItem) => void
}

/**
 * "Plan items": every income and fixed expense in one grouped, collapsible
 * ledger (by category, by week of the month or flat), with search, a paused
 * filter and the total of the active fixed expenses at the bottom.
 */
export function MonthlyPlanLedger({ items, categories, today, onEdit, onToggle, onDelete }: MonthlyPlanLedgerProps) {
	const t = useTranslations('monthlyPlan')
	const locale = useAppLocale()
	const titleId = useId()
	const searchId = useId()

	const [{ groupBy, collapsed }, setPreferences] = useLedgerPreferences(items[0]?.user_id)
	const [query, setQuery] = useState('')
	const [showPaused, setShowPaused] = useState(true)
	// While searching every group starts open; this tracks the ones closed during the search only.
	const [searchCollapsed, setSearchCollapsed] = useState<Record<string, boolean>>({})

	const monthDays = daysInMonth(today.year, today.month)
	const searching = normalizeSearch(query) !== ''
	const currentWeek = weekOfDay(Math.min(today.day, monthDays))
	const monthShort = formatLocalDate(new Date(today.year, today.month, 1), locale, { month: 'short' }).replace('.', '')

	const categoryById = useMemo(() => {
		const map = new Map<string, { name: string; color: string }>()
		categories.forEach((category, index) => {
			map.set(category.id, {
				name: category.name,
				// The user's own color; the chart palette (by position) when there is none.
				color: category.color || `var(--color-chart-${(index % CHART_SERIES) + 1})`,
			})
		})
		return map
	}, [categories])

	const totalExpenses = useMemo(() => sumActiveDop(items.filter((item) => item.type === 'bill')), [items])
	const pausedCount = items.filter((item) => !item.is_active).length

	const groups = useMemo(() => {
		const visible = items.filter((item) => (showPaused || item.is_active) && matchesSearch(item, query))
		return groupPlanItems(visible, groupBy, { monthDays, totalExpenses })
	}, [items, showPaused, query, groupBy, monthDays, totalExpenses])

	const isOpen = (key: string) => (searching ? !searchCollapsed[key] : !collapsed[key])
	const anyOpen = groups.some((group) => isOpen(group.key))

	const toggleGroup = (key: string) => {
		if (searching) setSearchCollapsed((current) => ({ ...current, [key]: !current[key] }))
		else
			setPreferences((current) => ({ ...current, collapsed: { ...current.collapsed, [key]: !current.collapsed[key] } }))
	}

	const toggleAll = () => {
		const next = Object.fromEntries(groups.map((group) => [group.key, anyOpen]))
		if (searching) setSearchCollapsed(next)
		else setPreferences((current) => ({ ...current, collapsed: { ...current.collapsed, ...next } }))
	}

	const describe = (group: LedgerGroup) => {
		switch (group.kind) {
			case 'income':
				return { title: t('incomeGroup'), color: 'var(--color-success)', share: undefined }
			case 'category': {
				const category = group.categoryId ? categoryById.get(group.categoryId) : undefined
				return {
					title: category?.name ?? t('uncategorized'),
					color: category?.color ?? NEUTRAL_COLOR,
					share: group.expenseShare,
				}
			}
			case 'week':
				return {
					title: t('weekRange', { from: group.week?.from ?? 1, to: group.week?.to ?? monthDays, month: monthShort }),
					color: NEUTRAL_COLOR,
					share: group.expenseShare,
				}
			case 'noDay':
				return { title: t('noFixedDay'), color: NEUTRAL_COLOR, share: group.expenseShare }
			default:
				return { title: t('allItems'), color: NEUTRAL_COLOR, share: undefined }
		}
	}

	return (
		<section aria-labelledby={titleId} className='min-w-0'>
			<Card className='overflow-hidden'>
				<div className='flex flex-wrap items-center gap-2 border-b border-border px-4 py-3.5 sm:gap-3 sm:px-5'>
					<h2 id={titleId} className='w-full text-base font-semibold sm:mr-auto sm:w-auto'>
						{t('ledgerTitle')}
					</h2>

					<div className='relative w-full sm:w-52'>
						<label htmlFor={searchId} className='sr-only'>
							{t('searchItems')}
						</label>
						<Search
							className='pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground'
							aria-hidden='true'
						/>
						<Input
							id={searchId}
							type='search'
							value={query}
							onChange={(event) => {
								setQuery(event.target.value)
								setSearchCollapsed({})
							}}
							placeholder={t('searchItems')}
							className='h-11 pl-9 sm:h-10'
						/>
					</div>

					<fieldset className='grid w-full min-w-0 grid-cols-3 gap-0.5 rounded-md border-0 bg-muted p-[3px] sm:inline-flex sm:w-auto'>
						<legend className='sr-only'>{t('groupBy')}</legend>
						{LEDGER_GROUP_BY.map((option) => {
							const active = groupBy === option
							return (
								<button
									key={option}
									type='button'
									aria-pressed={active}
									onClick={() => setPreferences((current) => ({ ...current, groupBy: option }))}
									className={cn(
										'h-[38px] rounded-sm px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-[34px]',
										active ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
									)}
								>
									{t(GROUP_BY_LABEL[option])}
								</button>
							)
						})}
					</fieldset>

					{(pausedCount > 0 || groups.length > 0) && (
						<div className='flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-start'>
							{pausedCount > 0 && (
								<Button
									variant={showPaused ? 'default' : 'outline'}
									className='px-3'
									aria-pressed={showPaused}
									onClick={() => setShowPaused((current) => !current)}
								>
									{t('showPaused', { count: pausedCount })}
								</Button>
							)}
							{groups.length > 0 && (
								<Button
									variant='ghost'
									className='ml-auto px-2.5 underline underline-offset-4 sm:ml-0'
									onClick={toggleAll}
								>
									{anyOpen ? t('collapseAll') : t('expandAll')}
								</Button>
							)}
						</div>
					)}
				</div>

				<div
					aria-hidden='true'
					className={cn(
						LEDGER_ROW_GRID,
						LEDGER_ROW_INSET,
						'hidden border-b border-border bg-muted/40 py-2 text-xs font-medium text-muted-foreground sm:grid',
					)}
				>
					<span>{t('columnDay')}</span>
					<span>{t('columnName')}</span>
					<span className='text-right'>{t('columnAmount')}</span>
					<span />
				</div>

				{groups.map((group) => {
					const { title, color, share } = describe(group)
					const domId = `${titleId}-${group.key.replace(/[^a-zA-Z0-9-]/g, '-')}`
					return (
						<MonthlyPlanLedgerGroup
							key={group.key}
							id={domId}
							testId={group.key}
							title={title}
							color={color}
							count={group.items.length}
							share={share}
							subtotal={group.subtotal}
							open={isOpen(group.key)}
							onToggle={() => toggleGroup(group.key)}
							isCurrent={group.kind === 'week' && group.week?.index === currentWeek}
						>
							{group.items.map((item) => (
								<MonthlyPlanItemRow
									key={item.id}
									item={item}
									day={effectiveDay(item.day_of_month, monthDays)}
									category={groupBy !== 'category' && item.category_id ? categoryById.get(item.category_id) : undefined}
									onEdit={onEdit}
									onToggle={onToggle}
									onDelete={onDelete}
								/>
							))}
						</MonthlyPlanLedgerGroup>
					)
				})}

				{groups.length === 0 && (
					<EmptyState
						compact
						className='border-b border-border'
						title={t('noResultsTitle')}
						description={searching ? t('noResultsSearch', { query: query.trim() }) : t('noResultsPaused')}
					/>
				)}

				<div
					className='flex flex-wrap items-center justify-between gap-2 bg-muted/40 px-4 py-3.5 sm:px-5'
					data-testid='ledger-total'
				>
					<span className='font-medium'>{t('totalActiveExpenses')}</span>
					<Amount className='font-semibold' value={-totalExpenses} currency={PLAN_CURRENCY} signed />
				</div>
			</Card>
		</section>
	)
}
