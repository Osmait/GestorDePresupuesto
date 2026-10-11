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
import { useGetAccounts } from '@/hooks/queries/useAccountsQuery'
import { useGetCategories } from '@/hooks/queries/useCategoriesQuery'
import {
	useDeleteMonthlyPlanItem,
	useMonthlyPlanItems,
	useMonthlyPlanSummary,
	useToggleMonthlyPlanItem,
} from '@/hooks/queries/useMonthlyPlanQuery'
import { localToday, startingBalanceDop } from '@/lib/monthlyPlanUtils'
import { MonthlyPlanItem } from '@/types/monthlyPlan'
import { MonthlyPlanFlowCard } from './MonthlyPlanFlowCard'
import { MonthlyPlanFormModal } from './MonthlyPlanFormModal'
import { MonthlyPlanLedger } from './MonthlyPlanLedger'
import { MonthlyPlanSkeleton } from './MonthlyPlanSkeleton'
import { MonthlyPlanSummaryCard } from './MonthlyPlanSummaryCard'

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
	const accountsQuery = useGetAccounts()
	const toggleMutation = useToggleMonthlyPlanItem()
	const deleteMutation = useDeleteMonthlyPlanItem()
	const { openCreate, openEdit } = useMonthlyPlanContext()
	const [toDelete, setToDelete] = useState<MonthlyPlanItem | null>(null)
	// The user's local date; this page only renders on the client (data comes from queries).
	const [today] = useState(localToday)

	const pausedExpenses = items.filter((item) => item.type === 'bill' && !item.is_active).length
	const startBalance = useMemo(
		() => (accountsQuery.data ? startingBalanceDop(accountsQuery.data, summary?.usd_to_dop_rate ?? 0) : null),
		[accountsQuery.data, summary?.usd_to_dop_rate],
	)

	const handleToggle = (item: MonthlyPlanItem) => {
		toggleMutation.mutate({ id: item.id, isActive: !item.is_active })
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
			{summary && <MonthlyPlanSummaryCard summary={summary} pausedExpenses={pausedExpenses} />}

			<div className='grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_22.5rem]'>
				<MonthlyPlanLedger
					items={items}
					categories={categories}
					today={today}
					onEdit={openEdit}
					onToggle={handleToggle}
					onDelete={setToDelete}
				/>
				<MonthlyPlanFlowCard
					items={items}
					today={today}
					startBalance={startBalance}
					loading={accountsQuery.isLoading}
					error={accountsQuery.isError}
					onRetry={() => accountsQuery.refetch()}
				/>
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
