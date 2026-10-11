'use client'

import { ArrowDownRight, ArrowUpRight, Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Amount } from '@/components/shared/Amount'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PLAN_CURRENCY, shareOfTotal, sumActiveDop } from '@/lib/monthlyPlanUtils'
import { MonthlyPlanItem, MonthlyPlanItemType } from '@/types/monthlyPlan'
import { MonthlyPlanItemRow } from './MonthlyPlanItemRow'

interface MonthlyPlanColumnProps {
	type: MonthlyPlanItemType
	items: MonthlyPlanItem[]
	categoryNames: Map<string, string>
	onCreate: (_type: MonthlyPlanItemType) => void
	onEdit: (_item: MonthlyPlanItem) => void
	onToggle: (_item: MonthlyPlanItem) => void
	onDelete: (_item: MonthlyPlanItem) => void
}

export function MonthlyPlanColumn({
	type,
	items,
	categoryNames,
	onCreate,
	onEdit,
	onToggle,
	onDelete,
}: MonthlyPlanColumnProps) {
	const t = useTranslations('monthlyPlan')
	const isIncome = type === 'income'
	// Paused items are shown but excluded from the total, matching the backend.
	const total = sumActiveDop(items)
	const Icon = isIncome ? ArrowUpRight : ArrowDownRight

	return (
		<Card>
			<CardHeader>
				<div className='flex items-center justify-between gap-3'>
					<CardTitle className='flex items-center gap-2 text-base'>
						<Icon className={isIncome ? 'h-5 w-5 text-success' : 'h-5 w-5 text-destructive'} aria-hidden='true' />
						{isIncome ? t('incomeColumn') : t('expensesColumn')}
					</CardTitle>
					{items.length > 0 && (
						<Button variant='ghost' size='sm' onClick={() => onCreate(type)}>
							<Plus className='mr-1 h-4 w-4' aria-hidden='true' />
							{t('add')}
						</Button>
					)}
				</div>
			</CardHeader>
			<CardContent>
				{items.length === 0 ? (
					<EmptyState
						compact
						title={isIncome ? t('noIncomes') : t('noExpenses')}
						action={
							<Button variant='outline' onClick={() => onCreate(type)}>
								<Plus className='mr-2 h-4 w-4' aria-hidden='true' />
								{isIncome ? t('addFirstIncome') : t('addFirstExpense')}
							</Button>
						}
					/>
				) : (
					<>
						<div className='space-y-3'>
							{items.map((item) => (
								<MonthlyPlanItemRow
									key={item.id}
									item={item}
									categoryName={item.category_id ? categoryNames.get(item.category_id) : undefined}
									sharePercentage={shareOfTotal(item.amount_dop, total)}
									onEdit={onEdit}
									onToggle={onToggle}
									onDelete={onDelete}
								/>
							))}
						</div>

						<div className='mt-4 flex items-center justify-between border-t border-border pt-3'>
							<span className='text-sm font-medium text-muted-foreground'>{t('total')}</span>
							<span className='text-lg font-semibold' data-testid={`column-total-${type}`}>
								<Amount value={isIncome ? total : -total} currency={PLAN_CURRENCY} tone='auto' signed />
							</span>
						</div>
					</>
				)}
			</CardContent>
		</Card>
	)
}
