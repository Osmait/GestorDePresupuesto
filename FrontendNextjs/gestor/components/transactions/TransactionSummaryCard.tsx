'use client'

import { ListOrdered, TrendingDown, TrendingUp } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Amount } from '@/components/shared/Amount'
import { StatCard } from '@/components/shared/StatCard'
import { StatGrid } from '@/components/shared/StatGrid'
import { useFormatCurrency } from '@/hooks/useFormatCurrency'
import { Transaction, TransactionSummary } from '@/types/transaction'

/** KPI row of the transaction history: income, expenses and count for the current filters. */
export default function TransactionSummaryCard({
	transactions,
	summary,
}: {
	transactions: Transaction[]
	summary?: TransactionSummary | null
}) {
	const t = useTranslations('transactions')
	const formatCurrency = useFormatCurrency()
	// Totals come from the API already converted to DOP; the hint splits them by original currency.
	const totalIncome = summary?.total_income ?? 0
	const totalExpenses = summary?.total_expenses ?? 0
	const byCurrency = (dop: number, usd: number) => `${formatCurrency(dop, 'DOP')} · ${formatCurrency(usd, 'USD')}`

	return (
		<StatGrid columns={3}>
			<StatCard
				label={t('totalIncome')}
				icon={TrendingUp}
				tone='positive'
				value={<Amount value={totalIncome} currency='DOP' animate />}
				hint={byCurrency(summary?.income_dop ?? 0, summary?.income_usd ?? 0)}
			/>
			<StatCard
				label={t('totalExpenses')}
				icon={TrendingDown}
				tone='negative'
				value={<Amount value={totalExpenses} currency='DOP' animate />}
				hint={byCurrency(summary?.expenses_dop ?? 0, summary?.expenses_usd ?? 0)}
			/>
			<StatCard label={t('totalTransactions')} icon={ListOrdered} value={transactions.length} />
		</StatGrid>
	)
}
