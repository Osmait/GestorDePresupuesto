'use client'

import { GripHorizontal, Minus, SlidersHorizontal, Wrench, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode, PointerEvent as ReactPointerEvent } from 'react'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Amount } from '@/components/shared/Amount'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerClose, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useGetAccounts } from '@/hooks/queries/useAccountsQuery'
import { useGetDashboardSummary } from '@/hooks/queries/useAnalyticsQuery'
import { useGetBudgets } from '@/hooks/queries/useBudgetsQuery'
import { useGetCategories } from '@/hooks/queries/useCategoriesQuery'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { useFormatPercent } from '@/hooks/useFormatPercent'
import { BREAKPOINTS, useMediaQuery } from '@/hooks/useMediaQuery'
import type { AnalyticsQueryFilters, CategoryExpense } from '@/types/analytics'
import { createDefaultAnalysisFilters, useAnalysisContext } from './AnalysisContext'
import { AnalysisFiltersForm } from './AnalysisFilters'
import { buildAnalyticsFilters, daysBetween, fromApiDate } from './analysis-query'

const toolDefinitions = [
	{ id: 'what_if', titleKey: 'toolWhatIfTitle' },
	{ id: 'projection', titleKey: 'toolProjectionTitle' },
	{ id: 'compare', titleKey: 'toolCompareTitle' },
	{ id: 'export', titleKey: 'toolExportTitle' },
] as const

type ToolId = (typeof toolDefinitions)[number]['id']

type FloatingWindowState = {
	id: ToolId
	open: boolean
	minimized: boolean
	x: number
	y: number
	z: number
}

/** Desktop tool window width (px) and the margin kept to the viewport edges. */
const WINDOW_WIDTH = 380
const EDGE = 16
/** Keyboard move step (px); Shift moves 4×. */
const MOVE_STEP = 16

type Translate = ReturnType<typeof useTranslations>

function clampPosition(x: number, y: number) {
	if (typeof window === 'undefined') return { x, y }
	return {
		x: Math.max(EDGE, Math.min(x, window.innerWidth - Math.min(WINDOW_WIDTH, window.innerWidth - 2 * EDGE) - EDGE)),
		y: Math.max(EDGE, Math.min(y, window.innerHeight - 120)),
	}
}

function createInitialWindows(): Record<ToolId, FloatingWindowState> {
	return {
		what_if: { id: 'what_if', open: false, minimized: false, x: 120, y: 120, z: 50 },
		projection: { id: 'projection', open: false, minimized: false, x: 170, y: 150, z: 50 },
		compare: { id: 'compare', open: false, minimized: false, x: 220, y: 180, z: 50 },
		export: { id: 'export', open: false, minimized: false, x: 270, y: 210, z: 50 },
	}
}

function CategorySelect({
	id,
	value,
	onChange,
	categories,
	placeholder,
}: {
	id: string
	value: string
	onChange: (value: string) => void
	categories: CategoryExpense[]
	placeholder: string
}) {
	return (
		<Select value={value} onValueChange={onChange}>
			<SelectTrigger id={id}>
				<SelectValue placeholder={placeholder} />
			</SelectTrigger>
			<SelectContent className='z-[1000]'>
				{categories.map((category) => (
					<SelectItem key={category.id} value={category.id}>
						{category.label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	)
}

function Figure({ label, children }: { label: ReactNode; children: ReactNode }) {
	return (
		<div className='rounded-md border p-2'>
			<dt className='text-xs text-muted-foreground'>{label}</dt>
			<dd className='font-semibold tabular-nums'>{children}</dd>
		</div>
	)
}

function WhatIfTool({
	categories,
	totalIncome,
	totalExpenses,
	t,
}: {
	categories: CategoryExpense[]
	totalIncome: number
	totalExpenses: number
	t: Translate
}) {
	const fieldId = useId()
	const formatPercent = useFormatPercent()
	const [categoryId, setCategoryId] = useState<string>('')
	const [reductionPct, setReductionPct] = useState<number>(10)

	useEffect(() => {
		if (!categoryId && categories.length > 0) setCategoryId(categories[0].id)
	}, [categories, categoryId])

	const targetCategory = categories.find((category) => category.id === categoryId)
	const categorySpend = Math.max(0, targetCategory?.value || 0)
	const reductionAmount = (categorySpend * reductionPct) / 100
	const projectedExpenses = Math.max(0, totalExpenses - reductionAmount)
	const projectedNet = totalIncome - projectedExpenses
	const projectedSavingsRate = totalIncome > 0 ? (projectedNet / totalIncome) * 100 : 0

	return (
		<div className='space-y-4 text-sm'>
			<div className='space-y-2'>
				<Label htmlFor={`${fieldId}-category`}>{t('toolTargetCategory')}</Label>
				<CategorySelect
					id={`${fieldId}-category`}
					value={categoryId}
					onChange={setCategoryId}
					categories={categories}
					placeholder={t('category')}
				/>
			</div>

			<div className='space-y-2'>
				<div className='flex items-center justify-between'>
					<Label htmlFor={`${fieldId}-reduction`}>{t('toolReductionPercent')}</Label>
					<span className='text-xs text-muted-foreground tabular-nums'>{formatPercent(reductionPct)}</span>
				</div>
				<Input
					id={`${fieldId}-reduction`}
					type='range'
					min={0}
					max={100}
					step={1}
					value={reductionPct}
					aria-valuetext={formatPercent(reductionPct)}
					onChange={(event) => setReductionPct(Number(event.target.value))}
				/>
			</div>

			<dl className='grid grid-cols-2 gap-2'>
				<Figure label={t('toolPotentialCut')}>
					<Amount value={reductionAmount} currency='DOP' />
				</Figure>
				<Figure label={t('toolProjectedSavingsRate')}>{formatPercent(projectedSavingsRate)}</Figure>
			</dl>
		</div>
	)
}

function ProjectionTool({
	totalExpenses,
	plannedBudget,
	dateFrom,
	dateTo,
	t,
}: {
	totalExpenses: number
	plannedBudget: number
	dateFrom?: string
	dateTo?: string
	t: Translate
}) {
	const formatCurrency = useFormatCurrency()
	const today = new Date()
	const from = dateFrom ? fromApiDate(dateFrom) : new Date(today.getFullYear(), today.getMonth(), 1)
	const to = dateTo ? fromApiDate(dateTo) : new Date(today.getFullYear(), today.getMonth() + 1, 0)
	const effectiveToday = today > to ? to : today
	const elapsedDays = daysBetween(from, effectiveToday)
	const totalDays = daysBetween(from, to)
	const projectedClose = totalExpenses * (totalDays / elapsedDays)
	const projectedGap = plannedBudget - projectedClose

	return (
		<div className='space-y-3 text-sm'>
			<dl className='grid grid-cols-2 gap-2'>
				<Figure label={t('toolProjectedClose')}>
					<Amount value={projectedClose} currency='DOP' />
				</Figure>
				<Figure label={t('plannedBudget')}>
					<Amount value={plannedBudget} currency='DOP' />
				</Figure>
			</dl>
			<p className={projectedGap >= 0 ? 'text-success' : 'text-destructive'}>
				{projectedGap >= 0
					? t('toolProjectionOnTrack', { amount: formatCurrency(projectedGap, 'DOP') })
					: t('toolProjectionOver', { amount: formatCurrency(Math.abs(projectedGap), 'DOP') })}
			</p>
		</div>
	)
}

function CompareTool({ categories, t }: { categories: CategoryExpense[]; t: Translate }) {
	const fieldId = useId()
	const formatCurrency = useFormatCurrency()
	const [first, setFirst] = useState<string>('')
	const [second, setSecond] = useState<string>('')

	useEffect(() => {
		if (!first && categories.length > 0) setFirst(categories[0].id)
		if (!second && categories.length > 1) setSecond(categories[1].id)
	}, [categories, first, second])

	const firstCategory = categories.find((category) => category.id === first)
	const secondCategory = categories.find((category) => category.id === second)
	const firstValue = Math.max(0, firstCategory?.value || 0)
	const secondValue = Math.max(0, secondCategory?.value || 0)
	const diff = firstValue - secondValue
	const higher = diff >= 0 ? firstCategory : secondCategory

	return (
		<div className='space-y-4 text-sm'>
			<div className='space-y-2'>
				<Label htmlFor={`${fieldId}-first`}>{t('toolFirstCategory')}</Label>
				<CategorySelect
					id={`${fieldId}-first`}
					value={first}
					onChange={setFirst}
					categories={categories}
					placeholder={t('toolFirstCategory')}
				/>
			</div>
			<div className='space-y-2'>
				<Label htmlFor={`${fieldId}-second`}>{t('toolSecondCategory')}</Label>
				<CategorySelect
					id={`${fieldId}-second`}
					value={second}
					onChange={setSecond}
					categories={categories}
					placeholder={t('toolSecondCategory')}
				/>
			</div>
			<div className='rounded-md border p-2'>
				<p className='text-xs text-muted-foreground'>{t('toolDifference')}</p>
				<p className='font-semibold'>
					<Amount value={Math.abs(diff)} currency='DOP' />
				</p>
				<p className='text-xs text-muted-foreground'>
					{t('toolDifferenceHigher', {
						category: higher?.label || '-',
						amount: formatCurrency(Math.abs(diff), 'DOP'),
					})}
				</p>
			</div>
		</div>
	)
}

function ExportTool({
	activeFilters,
	totalIncome,
	totalExpenses,
	categories,
	t,
}: {
	activeFilters: AnalyticsQueryFilters
	totalIncome: number
	totalExpenses: number
	categories: CategoryExpense[]
	t: Translate
}) {
	const [status, setStatus] = useState<string>('')

	const snapshot = useMemo(() => {
		return {
			generated_at: new Date().toISOString(),
			filters: activeFilters,
			kpis: {
				total_income: totalIncome,
				total_expenses: totalExpenses,
				net_amount: totalIncome - totalExpenses,
			},
			top_categories: categories.slice(0, 5).map((category) => ({
				id: category.id,
				label: category.label,
				value: category.value,
			})),
		}
	}, [activeFilters, categories, totalExpenses, totalIncome])

	const snapshotText = JSON.stringify(snapshot, null, 2)

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(snapshotText)
			setStatus(t('toolCopied'))
		} catch {
			setStatus(t('toolCopyError'))
		}
	}

	const handleDownload = () => {
		const blob = new Blob([snapshotText], { type: 'application/json' })
		const url = URL.createObjectURL(blob)
		const link = document.createElement('a')
		link.href = url
		link.download = `analytics-snapshot-${Date.now()}.json`
		link.click()
		URL.revokeObjectURL(url)
		setStatus(t('toolDownloaded'))
	}

	return (
		<div className='space-y-3 text-sm'>
			<pre className='max-h-48 overflow-auto rounded-md border bg-muted/40 p-2 font-mono text-xs'>{snapshotText}</pre>
			<div className='flex flex-wrap gap-2'>
				<Button type='button' size='sm' variant='secondary' onClick={handleCopy}>
					{t('toolCopy')}
				</Button>
				<Button type='button' size='sm' variant='outline' onClick={handleDownload}>
					{t('toolDownload')}
				</Button>
			</div>
			<p className='min-h-4 text-xs text-muted-foreground' aria-live='polite'>
				{status}
			</p>
		</div>
	)
}

/**
 * Desktop tool window: a non-modal dialog that floats over the page. Draggable
 * by its header with the pointer, movable with the arrow keys from the move
 * button, closable with Escape. Focus moves into it on open.
 */
function FloatingToolWindow({
	title,
	state,
	t,
	onFocus,
	onClose,
	onMinimize,
	onMove,
	onStartDrag,
	children,
}: {
	title: string
	state: FloatingWindowState
	t: Translate
	onFocus: () => void
	onClose: () => void
	onMinimize: () => void
	onMove: (dx: number, dy: number) => void
	onStartDrag: (event: ReactPointerEvent<HTMLDivElement>) => void
	children: ReactNode
}) {
	const titleId = useId()
	const ref = useRef<HTMLDivElement>(null)

	useEffect(() => {
		ref.current?.focus()
	}, [])

	const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
		// Radix popovers (Select) prevent the Escape they consume.
		if (event.key === 'Escape' && !event.defaultPrevented) {
			event.stopPropagation()
			onClose()
		}
	}

	const handleMoveKey = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
		const step = event.shiftKey ? MOVE_STEP * 4 : MOVE_STEP
		const delta: Record<string, [number, number]> = {
			ArrowLeft: [-step, 0],
			ArrowRight: [step, 0],
			ArrowUp: [0, -step],
			ArrowDown: [0, step],
		}
		const move = delta[event.key]
		if (!move) return
		event.preventDefault()
		onMove(move[0], move[1])
	}

	return (
		<div
			ref={ref}
			role='dialog'
			aria-labelledby={titleId}
			tabIndex={-1}
			className='fixed flex max-h-[calc(100dvh-2rem)] w-[380px] max-w-[calc(100vw-2rem)] flex-col rounded-lg border bg-popover text-popover-foreground shadow-lg outline-none focus-visible:ring-2 focus-visible:ring-ring'
			style={{ left: state.x, top: state.y, zIndex: state.z }}
			onPointerDownCapture={onFocus}
			onFocusCapture={onFocus}
			onKeyDown={handleKeyDown}
		>
			<div
				className='flex cursor-move touch-none select-none items-center gap-1 rounded-t-lg border-b bg-muted/60 py-1 pr-1 pl-1'
				onPointerDown={(event) => {
					if ((event.target as HTMLElement).closest('button:not([data-drag-handle])')) return
					onStartDrag(event)
				}}
			>
				<Button
					type='button'
					variant='ghost'
					size='icon'
					data-drag-handle
					className='cursor-move text-muted-foreground'
					aria-label={t('toolMove', { tool: title })}
					onKeyDown={handleMoveKey}
				>
					<GripHorizontal className='h-4 w-4' aria-hidden='true' />
				</Button>
				<h2 id={titleId} className='min-w-0 flex-1 truncate text-sm font-semibold'>
					{title}
				</h2>
				<Button
					type='button'
					variant='ghost'
					size='icon'
					aria-label={t('toolMinimize', { tool: title })}
					onClick={onMinimize}
				>
					<Minus className='h-4 w-4' aria-hidden='true' />
				</Button>
				<Button
					type='button'
					variant='ghost'
					size='icon'
					aria-label={t('toolClose', { tool: title })}
					onClick={onClose}
				>
					<X className='h-4 w-4' aria-hidden='true' />
				</Button>
			</div>
			<div className='min-h-0 flex-1 overflow-y-auto p-4'>{children}</div>
		</div>
	)
}

export function AnalysisActions() {
	const t = useTranslations('analysis')
	const isDesktop = useMediaQuery(BREAKPOINTS.md)
	const [drawerOpen, setDrawerOpen] = useState(false)
	const toolsTriggerRef = useRef<HTMLButtonElement>(null)
	const openingToolRef = useRef(false)
	const dragRef = useRef<{ id: ToolId; startX: number; startY: number; originX: number; originY: number } | null>(null)
	const zCounterRef = useRef(60)
	const [windows, setWindows] = useState<Record<ToolId, FloatingWindowState>>(() => createInitialWindows())
	const { filters, setFilters } = useAnalysisContext()
	const { data: accounts = [] } = useGetAccounts()
	const { data: categories = [] } = useGetCategories()
	const { data: budgets = [] } = useGetBudgets()

	const activeFilters = useMemo(() => buildAnalyticsFilters(filters), [filters])
	const { data: dashboardSummary } = useGetDashboardSummary(activeFilters)

	const categoryExpenses = dashboardSummary?.category_expenses || []
	const totalIncome = dashboardSummary?.total_income || 0
	const totalExpenses = dashboardSummary?.total_expenses || 0
	const plannedBudget = budgets.reduce((sum, budget) => sum + budget.amount, 0)

	const nextZ = () => {
		zCounterRef.current += 1
		return zCounterRef.current
	}

	const updateWindow = (id: ToolId, patch: Partial<FloatingWindowState>) => {
		setWindows((current) => ({ ...current, [id]: { ...current[id], ...patch } }))
	}

	const openTool = (id: ToolId) => {
		openingToolRef.current = true
		const position = clampPosition(windows[id].x, windows[id].y)
		updateWindow(id, { open: true, minimized: false, z: nextZ(), ...position })
	}

	const focusWindow = (id: ToolId) => {
		const topZ = Math.max(...Object.values(windows).map((state) => state.z))
		if (windows[id].z < topZ) updateWindow(id, { z: nextZ() })
	}

	const closeWindow = (id: ToolId) => {
		updateWindow(id, { open: false, minimized: false })
		toolsTriggerRef.current?.focus()
	}

	const minimizeWindow = (id: ToolId) => {
		updateWindow(id, { minimized: true })
		toolsTriggerRef.current?.focus()
	}

	const restoreWindow = (id: ToolId) => {
		updateWindow(id, { minimized: false, open: true, z: nextZ() })
	}

	const moveWindow = (id: ToolId, dx: number, dy: number) => {
		setWindows((current) => ({
			...current,
			[id]: { ...current[id], ...clampPosition(current[id].x + dx, current[id].y + dy) },
		}))
	}

	const startDragging = (event: ReactPointerEvent<HTMLDivElement>, id: ToolId) => {
		event.preventDefault()
		const current = windows[id]
		dragRef.current = {
			id,
			startX: event.clientX,
			startY: event.clientY,
			originX: current.x,
			originY: current.y,
		}
	}

	useEffect(() => {
		const handleMove = (event: PointerEvent) => {
			if (!dragRef.current) return
			const { id, startX, startY, originX, originY } = dragRef.current
			const next = clampPosition(originX + (event.clientX - startX), originY + (event.clientY - startY))
			setWindows((current) => ({ ...current, [id]: { ...current[id], ...next } }))
		}

		const handleUp = () => {
			dragRef.current = null
		}

		window.addEventListener('pointermove', handleMove)
		window.addEventListener('pointerup', handleUp)

		return () => {
			window.removeEventListener('pointermove', handleMove)
			window.removeEventListener('pointerup', handleUp)
		}
	}, [])

	const minimizedWindows = toolDefinitions.filter((tool) => windows[tool.id].open && windows[tool.id].minimized)

	const renderToolContent = (id: ToolId) => {
		switch (id) {
			case 'what_if':
				return (
					<WhatIfTool categories={categoryExpenses} totalIncome={totalIncome} totalExpenses={totalExpenses} t={t} />
				)
			case 'projection':
				return (
					<ProjectionTool
						totalExpenses={totalExpenses}
						plannedBudget={plannedBudget}
						dateFrom={activeFilters.date_from}
						dateTo={activeFilters.date_to}
						t={t}
					/>
				)
			case 'compare':
				return <CompareTool categories={categoryExpenses} t={t} />
			case 'export':
				return (
					<ExportTool
						activeFilters={activeFilters}
						totalIncome={totalIncome}
						totalExpenses={totalExpenses}
						categories={categoryExpenses}
						t={t}
					/>
				)
			default:
				return null
		}
	}

	return (
		<>
			<div className='flex flex-wrap items-center gap-2'>
				<Button variant='outline' onClick={() => setDrawerOpen(true)}>
					<SlidersHorizontal className='mr-2 h-4 w-4' aria-hidden='true' />
					{t('filter')}
				</Button>

				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button ref={toolsTriggerRef} variant='outline'>
							<Wrench className='mr-2 h-4 w-4' aria-hidden='true' />
							{t('tools')}
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						align='end'
						className='w-56'
						onCloseAutoFocus={(event) => {
							// The opened tool window takes focus instead of the trigger.
							if (openingToolRef.current) {
								event.preventDefault()
								openingToolRef.current = false
							}
						}}
					>
						{toolDefinitions.map((tool) => (
							<DropdownMenuItem key={tool.id} onSelect={() => openTool(tool.id)}>
								{t(tool.titleKey)}
							</DropdownMenuItem>
						))}
					</DropdownMenuContent>
				</DropdownMenu>

				<Drawer open={drawerOpen} onOpenChange={setDrawerOpen} side='right'>
					{/* Filter drawer has no description; opt out explicitly (Radix warns otherwise). */}
					<DrawerContent side='right' className='overflow-y-auto p-6' aria-describedby={undefined}>
						<DrawerHeader className='px-0 text-left'>
							<DrawerTitle>{t('filterAnalytics')}</DrawerTitle>
						</DrawerHeader>
						<AnalysisFiltersForm
							filters={filters}
							setFilters={setFilters}
							accounts={accounts}
							categories={categories}
						/>
						<DrawerFooter className='px-0'>
							<Button
								type='button'
								variant='outline'
								onClick={() => setFilters(createDefaultAnalysisFilters())}
								className='w-full'
							>
								{t('clearFilters')}
							</Button>
							<DrawerClose asChild>
								<Button type='button' className='w-full'>
									{t('close')}
								</Button>
							</DrawerClose>
						</DrawerFooter>
					</DrawerContent>
				</Drawer>
			</div>

			{toolDefinitions.map((tool) => {
				const windowState = windows[tool.id]
				const title = t(tool.titleKey)

				if (!isDesktop) {
					// Mobile: a full-width bottom drawer (modal, Escape and swipe to close).
					return (
						<Drawer
							key={tool.id}
							open={windowState.open}
							onOpenChange={(open) => {
								if (!open) closeWindow(tool.id)
							}}
							shouldScaleBackground={false}
						>
							<DrawerContent className='max-h-[90dvh]' aria-describedby={undefined}>
								<DrawerHeader className='flex items-center justify-between gap-2 text-left'>
									<DrawerTitle>{title}</DrawerTitle>
									<DrawerClose asChild>
										<Button type='button' variant='ghost' size='icon' aria-label={t('toolClose', { tool: title })}>
											<X className='h-4 w-4' aria-hidden='true' />
										</Button>
									</DrawerClose>
								</DrawerHeader>
								<div className='min-h-0 flex-1 overflow-y-auto px-4 pb-6'>{renderToolContent(tool.id)}</div>
							</DrawerContent>
						</Drawer>
					)
				}

				if (!windowState.open || windowState.minimized) return null

				return (
					<FloatingToolWindow
						key={tool.id}
						title={title}
						state={windowState}
						t={t}
						onFocus={() => focusWindow(tool.id)}
						onClose={() => closeWindow(tool.id)}
						onMinimize={() => minimizeWindow(tool.id)}
						onMove={(dx, dy) => moveWindow(tool.id, dx, dy)}
						onStartDrag={(event) => startDragging(event, tool.id)}
					>
						{renderToolContent(tool.id)}
					</FloatingToolWindow>
				)
			})}

			{isDesktop && minimizedWindows.length > 0 && (
				<div className='fixed right-4 bottom-4 z-[120] flex flex-wrap justify-end gap-2'>
					{minimizedWindows.map((tool) => (
						<Button
							key={tool.id}
							type='button'
							size='sm'
							variant='secondary'
							className='shadow-md'
							aria-label={t('toolRestore', { tool: t(tool.titleKey) })}
							onClick={() => restoreWindow(tool.id)}
						>
							{t(tool.titleKey)}
						</Button>
					))}
				</div>
			)}
		</>
	)
}
