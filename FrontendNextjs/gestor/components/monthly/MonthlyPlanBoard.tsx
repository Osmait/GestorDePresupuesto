'use client'

import { domAnimation, LazyMotion, m } from 'framer-motion'
import { CalendarClock, Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useMonthlyPlanContext } from '@/components/monthly/MonthlyPlanContext'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { Button } from '@/components/ui/button'
import { useGetCategories } from '@/hooks/queries/useCategoriesQuery'
import {
	useDeleteMonthlyPlanItem,
	useMonthlyPlanItems,
	useMonthlyPlanSummary,
	useToggleMonthlyPlanItem,
} from '@/hooks/queries/useMonthlyPlanQuery'
import { MonthlyPlanItem } from '@/types/monthlyPlan'
import { MonthlyPlanCategoryBreakdown } from './MonthlyPlanCategoryBreakdown'
import { MonthlyPlanColumn } from './MonthlyPlanColumn'
import { MonthlyPlanFormModal } from './MonthlyPlanFormModal'
import { MonthlyPlanSkeleton } from './MonthlyPlanSkeleton'
import { MonthlyPlanSummaryCard } from './MonthlyPlanSummaryCard'
import { MonthlyPlanTimeline } from './MonthlyPlanTimeline'

// m + LazyMotion(domAnimation) instead of motion: only fades/scales are used, so the
// full feature bundle (layout, drag) is not needed.
export function MonthlyPlanBoard() {
	return (
		<LazyMotion features={domAnimation}>
			<MonthlyPlanBoardView />
		</LazyMotion>
	)
}

function MonthlyPlanBoardView() {
	const t = useTranslations('monthlyPlan')
	const { data: items = [], isLoading, isError, refetch } = useMonthlyPlanItems()
	const { data: summary } = useMonthlyPlanSummary()
	const { data: categories = [] } = useGetCategories()
	const toggleMutation = useToggleMonthlyPlanItem()
	const deleteMutation = useDeleteMonthlyPlanItem()
	const { openCreate, openEdit } = useMonthlyPlanContext()
	const [toDelete, setToDelete] = useState<MonthlyPlanItem | null>(null)

	const categoryNames = useMemo(() => new Map(categories.map((category) => [category.id, category.name])), [categories])

	const incomes = useMemo(() => items.filter((item) => item.type === 'income'), [items])
	const expenses = useMemo(() => items.filter((item) => item.type === 'bill'), [items])

	const handleToggle = (item: MonthlyPlanItem) => {
		toggleMutation.mutate({ id: item.id, isActive: !item.is_active })
	}

	const handleDelete = (item: MonthlyPlanItem) => {
		setToDelete(item)
	}

	if (isLoading) {
		return <MonthlyPlanSkeleton />
	}

	if (isError) {
		return (
			<ErrorState
				title={t('errorLoading')}
				description={t('errorLoadingDescription')}
				retryLabel={t('tryAgain')}
				onRetry={() => refetch()}
			/>
		)
	}

	if (items.length === 0) {
		return (
			<>
				<EmptyState
					icon={CalendarClock}
					title={t('emptyTitle')}
					description={t('emptyDescription')}
					action={
						<>
							<Button onClick={() => openCreate('income')}>
								<Plus className='mr-2 h-4 w-4' aria-hidden='true' />
								{t('addFirstIncome')}
							</Button>
							<Button variant='outline' onClick={() => openCreate('bill')}>
								<Plus className='mr-2 h-4 w-4' aria-hidden='true' />
								{t('addFirstExpense')}
							</Button>
						</>
					}
				/>
				<MonthlyPlanFormModal />
			</>
		)
	}

	return (
		<m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }} className='space-y-6'>
			{summary && <MonthlyPlanSummaryCard summary={summary} />}

			<div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
				<MonthlyPlanColumn
					type='income'
					items={incomes}
					categoryNames={categoryNames}
					onCreate={openCreate}
					onEdit={openEdit}
					onToggle={handleToggle}
					onDelete={handleDelete}
				/>
				<MonthlyPlanColumn
					type='bill'
					items={expenses}
					categoryNames={categoryNames}
					onCreate={openCreate}
					onEdit={openEdit}
					onToggle={handleToggle}
					onDelete={handleDelete}
				/>
			</div>

			<div className='grid grid-cols-1 gap-6 lg:grid-cols-2'>
				<MonthlyPlanCategoryBreakdown items={items} categoryNames={categoryNames} />
				<MonthlyPlanTimeline items={items} />
			</div>

			<MonthlyPlanFormModal />

			<ConfirmDialog
				open={toDelete !== null}
				onOpenChange={(open) => !open && setToDelete(null)}
				title={t('confirmDelete', { name: toDelete?.name ?? '' })}
				description={t('deleteDescription')}
				confirmLabel={t('delete')}
				destructive
				onConfirm={async () => {
					if (!toDelete) return
					try {
						await deleteMutation.mutateAsync(toDelete.id)
					} catch (error) {
						toast.error(t('deleteError'))
						throw error
					}
				}}
			/>
		</m.div>
	)
}
