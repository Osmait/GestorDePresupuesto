'use client'

import { AlertTriangle, PiggyBank, TrendingDown, Wallet } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Amount } from '@/components/shared/Amount'
import { StatCard } from '@/components/shared/StatCard'
import { StatGrid } from '@/components/shared/StatGrid'
import { Budget } from '@/types/budget'

/** KPI row of the budgets page (amounts are DOP: the API converts USD expenses). */
export function BudgetSummaryCard({ budgets }: { budgets: Budget[] }) {
	const t = useTranslations('budgets')
	const list = budgets ?? []
	const totalBudget = list.reduce((sum, budget) => sum + budget.amount, 0)
	const totalSpent = list.reduce((sum, budget) => sum + budget.current_amount, 0)
	const totalRemaining = totalBudget - totalSpent
	const overBudgetCount = list.filter((budget) => budget.current_amount > budget.amount).length

	return (
		<StatGrid>
			<StatCard label={t('totalBudget')} icon={PiggyBank} value={<Amount value={totalBudget} currency='DOP' />} />
			<StatCard label={t('totalSpent')} icon={TrendingDown} value={<Amount value={totalSpent} currency='DOP' />} />
			<StatCard
				label={t('totalRemaining')}
				icon={Wallet}
				tone={totalRemaining < 0 ? 'negative' : 'default'}
				value={<Amount value={totalRemaining} currency='DOP' />}
			/>
			<StatCard
				label={t('exceededBudgets')}
				icon={AlertTriangle}
				tone={overBudgetCount > 0 ? 'negative' : 'default'}
				value={overBudgetCount}
			/>
		</StatGrid>
	)
}
