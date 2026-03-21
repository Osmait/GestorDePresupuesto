'use client'

import { Minus, Wrench, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Drawer, DrawerClose, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useGetAccounts } from '@/hooks/queries/useAccountsQuery'
import { useGetDashboardSummary } from '@/hooks/queries/useAnalyticsQuery'
import { useGetBudgets } from '@/hooks/queries/useBudgetsQuery'
import { useGetCategories } from '@/hooks/queries/useCategoriesQuery'
import { AnalyticsQueryFilters, CategoryExpense } from '@/types/analytics'
import { AnalysisFiltersState, useAnalysisContext } from './AnalysisContext'
import { AnalysisFiltersForm } from './AnalysisFilters'

const now = new Date()
const defaultMonth = String(now.getMonth() + 1).padStart(2, '0')
const defaultYear = String(now.getFullYear())

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

function formatDate(date: Date) {
	return date.toISOString().split('T')[0]
}

function buildAnalyticsFiltersFromState(filters: AnalysisFiltersState): AnalyticsQueryFilters {
	const next: AnalyticsQueryFilters = {}

	if (filters.filterMode === 'month') {
		const selectedYear = Number(filters.year || new Date().getFullYear())
		if (filters.month && filters.month !== 'all') {
			const selectedMonth = Number(filters.month)
			const from = new Date(selectedYear, selectedMonth - 1, 1)
			const to = new Date(selectedYear, selectedMonth, 0)
			next.date_from = formatDate(from)
			next.date_to = formatDate(to)
		} else {
			const from = new Date(selectedYear, 0, 1)
			const to = new Date(selectedYear, 11, 31)
			next.date_from = formatDate(from)
			next.date_to = formatDate(to)
		}
	} else if (filters.dateRange?.from && filters.dateRange?.to) {
		next.date_from = formatDate(filters.dateRange.from)
		next.date_to = formatDate(filters.dateRange.to)
	}

	if (filters.account !== 'all') next.account_id = filters.account
	if (filters.category !== 'all') next.category_id = filters.category
	if (filters.type === 'INCOME') next.type = 'income'
	if (filters.type === 'BILL') next.type = 'bill'

	const minAmount = Number(filters.minAmount)
	if (filters.minAmount !== '' && !Number.isNaN(minAmount) && minAmount >= 0) next.min_amount = minAmount

	const maxAmount = Number(filters.maxAmount)
	if (filters.maxAmount !== '' && !Number.isNaN(maxAmount) && maxAmount >= 0) next.max_amount = maxAmount

	return next
}

function createInitialWindows(): Record<ToolId, FloatingWindowState> {
	return {
		what_if: { id: 'what_if', open: false, minimized: false, x: 120, y: 120, z: 50 },
		projection: { id: 'projection', open: false, minimized: false, x: 170, y: 150, z: 50 },
		compare: { id: 'compare', open: false, minimized: false, x: 220, y: 180, z: 50 },
		export: { id: 'export', open: false, minimized: false, x: 270, y: 210, z: 50 },
	}
}

function formatDOP(value: number): string {
	return new Intl.NumberFormat('es-DO', {
		style: 'currency',
		currency: 'DOP',
		maximumFractionDigits: 2,
	}).format(value)
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
	t: ReturnType<typeof useTranslations>
}) {
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
		<div className='space-y-3 text-sm'>
			<div>
				<p className='mb-1 text-xs text-muted-foreground'>{t('toolTargetCategory')}</p>
				<Select value={categoryId} onValueChange={setCategoryId}>
					<SelectTrigger className='h-8'>
						<SelectValue placeholder={t('category')} />
					</SelectTrigger>
					<SelectContent className='z-[1000]'>
						{categories.map((category) => (
							<SelectItem key={category.id} value={category.id}>
								{category.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			<div>
				<p className='mb-1 text-xs text-muted-foreground'>{t('toolReductionPercent')}</p>
				<Input
					type='range'
					min={0}
					max={100}
					step={1}
					value={reductionPct}
					onChange={(event) => setReductionPct(Number(event.target.value))}
				/>
				<p className='mt-1 text-xs text-muted-foreground'>{reductionPct}%</p>
			</div>

			<div className='grid grid-cols-2 gap-2'>
				<div className='rounded-md border border-border/50 p-2'>
					<p className='text-xs text-muted-foreground'>{t('toolPotentialCut')}</p>
					<p className='font-semibold'>{formatDOP(reductionAmount)}</p>
				</div>
				<div className='rounded-md border border-border/50 p-2'>
					<p className='text-xs text-muted-foreground'>{t('toolProjectedSavingsRate')}</p>
					<p className='font-semibold'>{projectedSavingsRate.toFixed(1)}%</p>
				</div>
			</div>
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
	t: ReturnType<typeof useTranslations>
}) {
	const today = new Date()
	const from = dateFrom ? new Date(`${dateFrom}T00:00:00`) : new Date(today.getFullYear(), today.getMonth(), 1)
	const to = dateTo ? new Date(`${dateTo}T00:00:00`) : new Date(today.getFullYear(), today.getMonth() + 1, 0)
	const effectiveToday = today > to ? to : today
	const elapsedDays = Math.max(1, Math.floor((effectiveToday.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)) + 1)
	const totalDays = Math.max(1, Math.floor((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)) + 1)
	const projectedClose = totalExpenses * (totalDays / elapsedDays)
	const projectedGap = plannedBudget - projectedClose

	return (
		<div className='space-y-3 text-sm'>
			<div className='grid grid-cols-2 gap-2'>
				<div className='rounded-md border border-border/50 p-2'>
					<p className='text-xs text-muted-foreground'>{t('toolProjectedClose')}</p>
					<p className='font-semibold'>{formatDOP(projectedClose)}</p>
				</div>
				<div className='rounded-md border border-border/50 p-2'>
					<p className='text-xs text-muted-foreground'>{t('plannedBudget')}</p>
					<p className='font-semibold'>{formatDOP(plannedBudget)}</p>
				</div>
			</div>
			<p className={`text-xs ${projectedGap >= 0 ? 'text-emerald-600' : 'text-destructive'}`}>
				{projectedGap >= 0
					? t('toolProjectionOnTrack', { amount: formatDOP(projectedGap) })
					: t('toolProjectionOver', { amount: formatDOP(Math.abs(projectedGap)) })}
			</p>
		</div>
	)
}

function CompareTool({ categories, t }: { categories: CategoryExpense[]; t: ReturnType<typeof useTranslations> }) {
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

	return (
		<div className='space-y-3 text-sm'>
			<div className='grid grid-cols-1 gap-2'>
				<Select value={first} onValueChange={setFirst}>
					<SelectTrigger className='h-8'>
						<SelectValue placeholder={t('toolFirstCategory')} />
					</SelectTrigger>
					<SelectContent className='z-[1000]'>
						{categories.map((category) => (
							<SelectItem key={category.id} value={category.id}>
								{category.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Select value={second} onValueChange={setSecond}>
					<SelectTrigger className='h-8'>
						<SelectValue placeholder={t('toolSecondCategory')} />
					</SelectTrigger>
					<SelectContent className='z-[1000]'>
						{categories.map((category) => (
							<SelectItem key={category.id} value={category.id}>
								{category.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
			<div className='rounded-md border border-border/50 p-2'>
				<p className='text-xs text-muted-foreground'>{t('toolDifference')}</p>
				<p className={`font-semibold ${diff >= 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
					{formatDOP(Math.abs(diff))}
				</p>
				<p className='text-xs text-muted-foreground'>
					{diff >= 0
						? t('toolDifferenceHigher', { category: firstCategory?.label || '-', amount: formatDOP(Math.abs(diff)) })
						: t('toolDifferenceHigher', { category: secondCategory?.label || '-', amount: formatDOP(Math.abs(diff)) })}
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
	t: ReturnType<typeof useTranslations>
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
			<div className='max-h-36 overflow-auto rounded-md border border-border/50 bg-muted/30 p-2 text-xs'>
				<pre>{snapshotText}</pre>
			</div>
			<div className='flex gap-2'>
				<Button type='button' size='sm' variant='secondary' onClick={handleCopy}>
					{t('toolCopy')}
				</Button>
				<Button type='button' size='sm' variant='outline' onClick={handleDownload}>
					{t('toolDownload')}
				</Button>
			</div>
			{status && <p className='text-xs text-muted-foreground'>{status}</p>}
		</div>
	)
}

export function AnalysisActions() {
	const t = useTranslations('analysis')
	const [drawerOpen, setDrawerOpen] = useState(false)
	const dragRef = useRef<{ id: ToolId; startX: number; startY: number; originX: number; originY: number } | null>(null)
	const [windows, setWindows] = useState<Record<ToolId, FloatingWindowState>>(() => createInitialWindows())
	const [_zCounter, setZCounter] = useState(60)
	const { filters, setFilters } = useAnalysisContext()
	const { data: accounts = [] } = useGetAccounts()
	const { data: categories = [] } = useGetCategories()
	const { data: budgets = [] } = useGetBudgets()

	const activeFilters = useMemo(() => buildAnalyticsFiltersFromState(filters), [filters])
	const { data: dashboardSummary } = useGetDashboardSummary(activeFilters)

	const categoryExpenses = dashboardSummary?.category_expenses || []
	const totalIncome = dashboardSummary?.total_income || 0
	const totalExpenses = dashboardSummary?.total_expenses || 0
	const plannedBudget = budgets.reduce((sum, budget) => sum + budget.amount, 0)

	const openTool = (id: ToolId) => {
		setZCounter((previous) => {
			const next = previous + 1
			setWindows((current) => ({
				...current,
				[id]: { ...current[id], open: true, minimized: false, z: next },
			}))
			return next
		})
	}

	const focusWindow = (id: ToolId) => {
		setZCounter((previous) => {
			const next = previous + 1
			setWindows((current) => ({
				...current,
				[id]: { ...current[id], z: next },
			}))
			return next
		})
	}

	const closeWindow = (id: ToolId) => {
		setWindows((current) => ({
			...current,
			[id]: { ...current[id], open: false, minimized: false },
		}))
	}

	const minimizeWindow = (id: ToolId) => {
		setWindows((current) => ({
			...current,
			[id]: { ...current[id], minimized: true },
		}))
	}

	const restoreWindow = (id: ToolId) => {
		setZCounter((previous) => {
			const next = previous + 1
			setWindows((current) => ({
				...current,
				[id]: { ...current[id], minimized: false, open: true, z: next },
			}))
			return next
		})
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
		focusWindow(id)
	}

	useEffect(() => {
		const handleMove = (event: PointerEvent) => {
			if (!dragRef.current) return
			const { id, startX, startY, originX, originY } = dragRef.current
			const nextX = originX + (event.clientX - startX)
			const nextY = originY + (event.clientY - startY)
			setWindows((current) => ({
				...current,
				[id]: {
					...current[id],
					x: Math.max(16, Math.min(nextX, window.innerWidth - 420)),
					y: Math.max(16, Math.min(nextY, window.innerHeight - 120)),
				},
			}))
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
			<div className='flex items-center gap-3'>
				<Button variant='outline' className='border-border/50' onClick={() => setDrawerOpen(true)}>
					{t('filter')}
				</Button>

				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant='outline' className='border-border/50'>
							<Wrench className='mr-2 h-4 w-4' />
							{t('tools')}
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align='end' className='w-56'>
						{toolDefinitions.map((tool) => (
							<DropdownMenuItem key={tool.id} onSelect={() => openTool(tool.id)}>
								{t(tool.titleKey)}
							</DropdownMenuItem>
						))}
					</DropdownMenuContent>
				</DropdownMenu>

				<Drawer open={drawerOpen} onOpenChange={setDrawerOpen} side='right'>
					<DrawerContent side='right' className='p-6'>
						<DrawerHeader>
							<DrawerTitle>{t('filterAnalytics')}</DrawerTitle>
						</DrawerHeader>
						<AnalysisFiltersForm
							filters={filters}
							setFilters={setFilters}
							accounts={accounts}
							categories={categories}
						/>
						<DrawerFooter>
							<Button
								type='button'
								variant='outline'
								onClick={() =>
									setFilters({
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
								}
								className='w-full'
							>
								{t('clearFilters')}
							</Button>
							<DrawerClose asChild>
								<Button type='button' variant='ghost' className='w-full'>
									{t('close')}
								</Button>
							</DrawerClose>
						</DrawerFooter>
					</DrawerContent>
				</Drawer>
			</div>

			{toolDefinitions.map((tool) => {
				const windowState = windows[tool.id]
				if (!windowState.open || windowState.minimized) return null

				return (
					<div
						key={tool.id}
						className='fixed w-[380px] max-w-[92vw] rounded-lg border border-border/60 bg-background shadow-2xl'
						style={{ left: windowState.x, top: windowState.y, zIndex: windowState.z }}
						onMouseDown={() => focusWindow(tool.id)}
					>
						<div
							className='flex cursor-move items-center justify-between rounded-t-lg border-b border-border/50 bg-muted/70 px-3 py-2'
							onPointerDown={(event) => startDragging(event, tool.id)}
						>
							<div className='flex items-center gap-2'>
								<span className='h-2.5 w-2.5 rounded-full bg-red-500' />
								<span className='h-2.5 w-2.5 rounded-full bg-amber-400' />
								<span className='h-2.5 w-2.5 rounded-full bg-emerald-500' />
								<p className='text-xs font-semibold text-foreground'>{t(tool.titleKey)}</p>
							</div>
							<div className='flex items-center gap-1'>
								<Button
									type='button'
									variant='ghost'
									size='sm'
									className='h-6 w-6 p-0'
									onClick={() => minimizeWindow(tool.id)}
								>
									<Minus className='h-3.5 w-3.5' />
								</Button>
								<Button
									type='button'
									variant='ghost'
									size='sm'
									className='h-6 w-6 p-0'
									onClick={() => closeWindow(tool.id)}
								>
									<X className='h-3.5 w-3.5' />
								</Button>
							</div>
						</div>
						<div className='p-3'>{renderToolContent(tool.id)}</div>
					</div>
				)
			})}

			{minimizedWindows.length > 0 && (
				<div className='fixed bottom-4 right-4 z-[120] flex flex-wrap gap-2'>
					{minimizedWindows.map((tool) => (
						<Button key={tool.id} type='button' size='sm' variant='secondary' onClick={() => restoreWindow(tool.id)}>
							{t(tool.titleKey)}
						</Button>
					))}
				</div>
			)}
		</>
	)
}
