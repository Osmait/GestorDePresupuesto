'use client'

import { ArrowUpDown, Landmark, TrendingUp, Wallet } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Amount } from '@/components/shared/Amount'
import { StatCard } from '@/components/shared/StatCard'
import { StatGrid } from '@/components/shared/StatGrid'
import { DEFAULT_CURRENCY } from '@/lib/utils'
import { Account } from '@/types/account'

/** KPI row of the accounts page: total balance, change since the initial balances and account counts. */
export function AccountSummaryCard({ accounts }: { accounts: Account[] }) {
	const t = useTranslations('accounts')
	const list = accounts ?? []
	// Totals are only meaningful in one currency: use the accounts' currency when
	// they all share it, DOP (the backend default) otherwise.
	const currencies = new Set(list.map((account) => account.currency || DEFAULT_CURRENCY))
	const currency = currencies.size === 1 ? Array.from(currencies)[0] : DEFAULT_CURRENCY
	const totalCurrentBalance = list.reduce(
		(sum, account) => sum + (account.current_balance ?? account.initial_balance ?? 0),
		0,
	)
	const totalInitialBalance = list.reduce((sum, account) => sum + (account.initial_balance ?? 0), 0)
	const positiveAccounts = list.filter((account) => (account.current_balance ?? account.initial_balance ?? 0) > 0)
	const balanceDifference = totalCurrentBalance - totalInitialBalance

	return (
		<StatGrid>
			<StatCard
				label={t('totalBalance')}
				icon={Wallet}
				value={<Amount value={totalCurrentBalance} currency={currency} />}
				hint={
					totalInitialBalance !== totalCurrentBalance ? (
						<>
							{t('initial')}: <Amount value={totalInitialBalance} currency={currency} />
						</>
					) : undefined
				}
			/>
			<StatCard
				label={t('totalDifference')}
				icon={ArrowUpDown}
				// Signed value: the color and the sign must agree (no Math.abs).
				value={<Amount value={balanceDifference} currency={currency} tone='auto' signed icon />}
			/>
			<StatCard label={t('positiveAccounts')} icon={TrendingUp} value={positiveAccounts.length} />
			<StatCard label={t('totalAccounts')} icon={Landmark} value={list.length} />
		</StatGrid>
	)
}
