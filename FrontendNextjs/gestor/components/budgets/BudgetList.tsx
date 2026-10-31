'use client'

import { PiggyBank, Plus } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { type ReactNode, useEffect } from 'react'
import { useBudgetContext } from '@/components/budgets/BudgetContext'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { Button } from '@/components/ui/button'
import { useBudgetTransactionCounts } from '@/hooks/queries/useBudgetsQuery'
import { useGetCategories } from '@/hooks/queries/useCategoriesQuery'
import { cn } from '@/lib/utils'
import { Budget } from '@/types/budget'
import { BudgetCard } from './BudgetCard'
import { BudgetFormModal } from './BudgetFormModal'
import { BudgetSummaryCard } from './BudgetSummaryCard'
import { BudgetsPageSkeleton } from './BudgetsPageSkeleton'

export function BudgetList() {
	const t = useTranslations('budgets')
	const router = useRouter()
	const searchParams = useSearchParams()
	const { budgets, isLoading, error, refetch, deleteBudget, setEditingBudget, isModalOpen, setModalOpen } =
		useBudgetContext()
	const { data: categories = [] } = useGetCategories()
	const list = budgets ?? []
	const { data: transactionCounts } = useBudgetTransactionCounts(list)

	const handleEdit = (budget: Budget) => {
		setEditingBudget(budget)
		setModalOpen(true)
	}

	const handleCreate = () => {
		setEditingBudget(null)
		setModalOpen(true)
	}

	const suggestedCategoryId = searchParams.get('category') || ''
	const selectedBudgetId = searchParams.get('selected') || ''

	useEffect(() => {
		const shouldOpenCreate = searchParams.get('create') === '1'
		if (!shouldOpenCreate) return

		setEditingBudget(null)
		setModalOpen(true)
		router.replace('/app/budget', { scroll: false })
	}, [router, searchParams, setEditingBudget, setModalOpen])

	useEffect(() => {
		if (!selectedBudgetId) return
		const element = document.getElementById(`budget-card-${selectedBudgetId}`)
		if (!element) return
		element.scrollIntoView({ behavior: 'smooth', block: 'center' })
	}, [selectedBudgetId])

	if (isLoading) {
		return <BudgetsPageSkeleton />
	}

	let content: ReactNode
	if (error && list.length === 0) {
		content = <ErrorState title={t('errorLoading')} onRetry={() => void refetch()} />
	} else if (list.length === 0) {
		content = (
			<EmptyState
				icon={PiggyBank}
				title={t('noBudgets')}
				description={t('noBudgetsDescription')}
				action={
					<Button onClick={handleCreate}>
						<Plus className='mr-2 h-4 w-4' aria-hidden='true' />
						{t('createFirstBudget')}
					</Button>
				}
			/>
		)
	} else {
		content = (
			<div className='space-y-6'>
				<BudgetSummaryCard budgets={list} />

				<div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
					{list.map((budget) => (
						<div
							key={budget.id}
							id={`budget-card-${budget.id}`}
							className={cn(
								'rounded-lg',
								selectedBudgetId === budget.id && 'ring-2 ring-primary/70 ring-offset-2 ring-offset-background',
							)}
						>
							<BudgetCard
								budget={budget}
								category={categories?.find((c) => c.id === budget.category_id)}
								transactionCount={transactionCounts?.[budget.id]}
								onDelete={deleteBudget}
								onEdit={handleEdit}
							/>
						</div>
					))}
				</div>
			</div>
		)
	}

	return (
		<>
			{content}
			{/* Context-controlled dialog for create/edit (also opened from the header and ?create=1). */}
			<BudgetFormModal open={isModalOpen} setOpen={setModalOpen} initialCategoryId={suggestedCategoryId} />
		</>
	)
}
