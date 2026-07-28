'use client'

import { motion } from 'framer-motion'
import { AlertTriangle, CalendarClock, PlusCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useMemo } from 'react'
import { useMonthlyPlanContext } from '@/components/monthly/MonthlyPlanContext'
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

export function MonthlyPlanBoard() {
	const t = useTranslations('monthlyPlan')
	const { data: items = [], isLoading, isError } = useMonthlyPlanItems()
	const { data: summary } = useMonthlyPlanSummary()
	const { data: categories = [] } = useGetCategories()
	const toggleMutation = useToggleMonthlyPlanItem()
	const deleteMutation = useDeleteMonthlyPlanItem()
	const { openCreate, openEdit } = useMonthlyPlanContext()

	const categoryNames = useMemo(() => new Map(categories.map((category) => [category.id, category.name])), [categories])

	const incomes = useMemo(() => items.filter((item) => item.type === 'income'), [items])
	const expenses = useMemo(() => items.filter((item) => item.type === 'bill'), [items])

	const handleToggle = (item: MonthlyPlanItem) => {
		toggleMutation.mutate({ id: item.id, isActive: !item.is_active })
	}

	const handleDelete = (item: MonthlyPlanItem) => {
		if (confirm(t('confirmDelete', { name: item.name }))) {
			deleteMutation.mutate(item.id)
		}
	}

	if (isLoading) {
		return <MonthlyPlanSkeleton />
	}

	if (isError) {
		return (
			<div className='flex flex-col items-center justify-center min-h-[400px]'>
				<AlertTriangle className='h-16 w-16 text-red-500 mb-4' />
				<h2 className='text-2xl font-bold text-foreground mb-2'>{t('errorLoading')}</h2>
				<Button className='mt-4' onClick={() => window.location.reload()}>
					{t('tryAgain')}
				</Button>
			</div>
		)
	}

	if (items.length === 0) {
		return (
			<>
				<div className='flex flex-col items-center justify-center min-h-[400px]'>
					<div className='p-6 rounded-full bg-gradient-to-br from-blue-500/20 to-purple-500/20 dark:from-blue-500/10 dark:to-purple-500/10 mb-6'>
						<CalendarClock className='h-16 w-16 text-blue-600 dark:text-blue-400' />
					</div>
					<h2 className='text-2xl font-bold text-foreground mb-2'>{t('emptyTitle')}</h2>
					<p className='text-muted-foreground text-center max-w-md mb-6'>{t('emptyDescription')}</p>
					<div className='flex flex-wrap gap-3 justify-center'>
						<Button onClick={() => openCreate('income')}>
							<PlusCircle className='h-4 w-4 mr-2' />
							{t('addFirstIncome')}
						</Button>
						<Button variant='outline' onClick={() => openCreate('bill')}>
							<PlusCircle className='h-4 w-4 mr-2' />
							{t('addFirstExpense')}
						</Button>
					</div>
				</div>
				<MonthlyPlanFormModal />
			</>
		)
	}

	return (
		<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }} className='space-y-8'>
			{summary && <MonthlyPlanSummaryCard summary={summary} />}

			<div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
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

			<div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
				<MonthlyPlanCategoryBreakdown items={items} categoryNames={categoryNames} />
				<MonthlyPlanTimeline items={items} />
			</div>

			<MonthlyPlanFormModal />
		</motion.div>
	)
}
