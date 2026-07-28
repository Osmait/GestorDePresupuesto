'use client'

import { PieChart } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDop, groupByCategory } from '@/lib/monthlyPlanUtils'
import { MonthlyPlanItem } from '@/types/monthlyPlan'

/**
 * Answers "where does my money actually go": each category's share of the total
 * fixed expenses, biggest first.
 */
export function MonthlyPlanCategoryBreakdown({
	items,
	categoryNames,
}: {
	items: MonthlyPlanItem[]
	categoryNames: Map<string, string>
}) {
	const t = useTranslations('monthlyPlan')
	const expenses = items.filter((item) => item.type === 'bill')
	const shares = groupByCategory(expenses, categoryNames, t('uncategorized'))

	if (shares.length === 0) {
		return null
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle className='flex items-center gap-2 text-base'>
					<PieChart className='h-5 w-5' />
					{t('breakdownTitle')}
				</CardTitle>
			</CardHeader>
			<CardContent className='space-y-3'>
				{shares.map((share) => (
					<div key={share.categoryId || 'uncategorized'} data-testid={`breakdown-${share.categoryId || 'none'}`}>
						<div className='mb-1 flex items-center justify-between gap-3 text-sm'>
							<span className='text-foreground truncate'>{share.label}</span>
							<span className='text-muted-foreground shrink-0'>
								{formatDop(share.amount)} · {share.percentage.toFixed(1)}%
							</span>
						</div>
						<div className='h-2 w-full overflow-hidden rounded-full bg-muted'>
							<div className='h-full rounded-full bg-orange-500' style={{ width: `${share.percentage}%` }} />
						</div>
					</div>
				))}
			</CardContent>
		</Card>
	)
}
