'use client'

import { PieChart } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Amount } from '@/components/shared/Amount'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { useFormatPercent } from '@/hooks/useFormatPercent'
import { groupByCategory, PLAN_CURRENCY } from '@/lib/monthlyPlanUtils'
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
	const formatPercent = useFormatPercent()
	const expenses = items.filter((item) => item.type === 'bill')
	const shares = groupByCategory(expenses, categoryNames, t('uncategorized'))

	if (shares.length === 0) {
		return null
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle className='flex items-center gap-2 text-base'>
					<PieChart className='h-5 w-5 text-muted-foreground' aria-hidden='true' />
					{t('breakdownTitle')}
				</CardTitle>
			</CardHeader>
			<CardContent className='space-y-3'>
				{shares.map((share) => (
					<div key={share.categoryId || 'uncategorized'} data-testid={`breakdown-${share.categoryId || 'none'}`}>
						<div className='mb-1 flex items-center justify-between gap-3 text-sm'>
							<span className='truncate text-foreground'>{share.label}</span>
							<span className='shrink-0 text-muted-foreground tabular-nums'>
								<Amount value={share.amount} currency={PLAN_CURRENCY} /> ·{' '}
								{formatPercent(share.percentage, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
							</span>
						</div>
						<Progress value={share.percentage} aria-label={t('categoryShare', { name: share.label })} />
					</div>
				))}
			</CardContent>
		</Card>
	)
}
