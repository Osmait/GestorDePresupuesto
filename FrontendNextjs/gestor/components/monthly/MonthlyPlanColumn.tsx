'use client'

import { ArrowDownCircle, ArrowUpCircle, PlusCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDop, shareOfTotal, sumActiveDop } from '@/lib/monthlyPlanUtils'
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

	return (
		<Card>
			<CardHeader>
				<div className='flex items-center justify-between gap-3'>
					<CardTitle className='flex items-center gap-2 text-base'>
						{isIncome ? (
							<ArrowUpCircle className='h-5 w-5 text-emerald-600' />
						) : (
							<ArrowDownCircle className='h-5 w-5 text-orange-600' />
						)}
						{isIncome ? t('incomeColumn') : t('expensesColumn')}
					</CardTitle>
					<Button variant='ghost' size='sm' onClick={() => onCreate(type)} className='h-8'>
						<PlusCircle className='h-4 w-4 mr-1' />
						{t('add')}
					</Button>
				</div>
			</CardHeader>
			<CardContent>
				{items.length === 0 ? (
					<div className='py-8 text-center'>
						<p className='text-sm text-muted-foreground'>{isIncome ? t('noIncomes') : t('noExpenses')}</p>
						<Button variant='outline' size='sm' className='mt-3' onClick={() => onCreate(type)}>
							<PlusCircle className='h-4 w-4 mr-1' />
							{isIncome ? t('addFirstIncome') : t('addFirstExpense')}
						</Button>
					</div>
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

						<div className='mt-4 flex items-center justify-between border-t border-border/60 pt-3'>
							<span className='text-sm font-medium text-muted-foreground'>{t('total')}</span>
							<span
								className={`text-lg font-bold ${isIncome ? 'text-emerald-600' : 'text-orange-600'}`}
								data-testid={`column-total-${type}`}
							>
								{formatDop(total)}
							</span>
						</div>
					</>
				)}
			</CardContent>
		</Card>
	)
}
