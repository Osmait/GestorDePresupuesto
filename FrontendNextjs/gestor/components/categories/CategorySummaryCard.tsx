'use client'

import { Activity, Hash, Tag } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { StatCard } from '@/components/shared/StatCard'
import { StatGrid } from '@/components/shared/StatGrid'
import { CategoryExpense } from '@/types/analytics'
import { Category } from '@/types/category'

/** KPI row of the categories page: how many there are, how many are used, transactions per used category. */
export function CategorySummaryCard({
	categories,
	categoryExpenses,
}: {
	categories: Category[]
	categoryExpenses: CategoryExpense[]
}) {
	const t = useTranslations('categories')
	const expenses = categoryExpenses ?? []
	const activeCategories = expenses.filter((item) => item.transaction_count > 0)
	const totalTransactions = expenses.reduce((sum, item) => sum + (item.transaction_count || 0), 0)
	const averagePerCategory = activeCategories.length > 0 ? Math.round(totalTransactions / activeCategories.length) : 0

	return (
		<StatGrid columns={3}>
			<StatCard label={t('totalCategories')} icon={Tag} value={(categories ?? []).length} />
			<StatCard label={t('activeCategories')} icon={Activity} value={activeCategories.length} />
			<StatCard label={t('averagePerCategory')} icon={Hash} value={averagePerCategory} />
		</StatGrid>
	)
}
