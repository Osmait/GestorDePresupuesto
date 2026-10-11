'use client'
import { Plus, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { AccountCard } from '@/components/accounts/AccountCard'
import { useAccountContext } from '@/components/accounts/AccountContext'
import { AccountSummaryCard } from '@/components/accounts/AccountSummaryCard'
import { AccountsPageSkeleton } from '@/components/accounts/AccountsPageSkeleton'
import { AccountUpdateModal } from '@/components/accounts/AccountUpdateModal'
import { AnimatedTabs } from '@/components/common/animated-tabs'
import { EmptyState } from '@/components/shared/EmptyState'
import { ErrorState } from '@/components/shared/ErrorState'
import { Button } from '@/components/ui/button'
import { Account } from '@/types/account'

type BalanceFilter = 'all' | 'positive' | 'negative'

function getAccountBalance(account: Account) {
	return account.current_balance ?? account.initial_balance ?? 0
}

export default function AccountsClient() {
	const t = useTranslations('accounts')
	const { accounts, isLoading, updateAccount, deleteAccount, error, refetch, setCreateOpen } = useAccountContext()
	const [updateModalOpen, setUpdateModalOpen] = useState(false)
	const [selectedAccount, setSelectedAccount] = useState<Account | null>(null)
	const list = Array.isArray(accounts) ? accounts : []

	const handleEditAccount = (account: Account) => {
		setSelectedAccount(account)
		setUpdateModalOpen(true)
	}

	if (isLoading) {
		return <AccountsPageSkeleton />
	}

	// A failed refetch keeps showing the cached list; only an empty failed load is an error page.
	if (error && list.length === 0) {
		return <ErrorState onRetry={() => void refetch()} />
	}

	if (list.length === 0) {
		return (
			<EmptyState
				icon={Wallet}
				title={t('emptyTitle')}
				description={t('emptyDescription')}
				action={
					<Button onClick={() => setCreateOpen(true)}>
						<Plus className='mr-2 h-4 w-4' aria-hidden='true' />
						{t('addAccount')}
					</Button>
				}
			/>
		)
	}

	const filterAccounts = (filter: BalanceFilter) => {
		switch (filter) {
			case 'positive':
				return list.filter((account) => getAccountBalance(account) > 0)
			case 'negative':
				return list.filter((account) => getAccountBalance(account) < 0)
			default:
				return list
		}
	}

	const emptyMessages: Record<BalanceFilter, string> = {
		all: t('noAccountsAll'),
		positive: t('noPositiveAccounts'),
		negative: t('noNegativeAccounts'),
	}

	const renderTabContent = (filter: BalanceFilter) => {
		const filteredAccounts = filterAccounts(filter)
		if (filteredAccounts.length === 0) {
			return <EmptyState compact icon={Wallet} title={emptyMessages[filter]} />
		}
		return (
			<div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
				{filteredAccounts.map((account) => (
					<AccountCard
						key={account.id}
						account={account}
						onAccountDeleted={() => deleteAccount(account.id!)}
						onAccountEdit={handleEditAccount}
					/>
				))}
			</div>
		)
	}

	const tabsConfig = [
		{ value: 'all', label: t('all'), icon: <Wallet className='h-4 w-4' />, filter: 'all' as const },
		{ value: 'positive', label: t('positive'), icon: <TrendingUp className='h-4 w-4' />, filter: 'positive' as const },
		{
			value: 'negative',
			label: t('negative'),
			icon: <TrendingDown className='h-4 w-4' />,
			filter: 'negative' as const,
		},
	]

	return (
		<div className='space-y-6'>
			<AccountSummaryCard accounts={list} />

			{/* Segmented balance filter (AnimatedTabs as a filter control, see DESIGN.md > Tabs). */}
			<AnimatedTabs
				defaultValue='all'
				className='space-y-6'
				tabs={tabsConfig.map((tab) => ({
					value: tab.value,
					label: tab.label,
					icon: tab.icon,
					content: renderTabContent(tab.filter),
				}))}
			/>

			<AccountUpdateModal
				open={updateModalOpen}
				setOpen={setUpdateModalOpen}
				account={selectedAccount}
				updateAccount={updateAccount}
			/>
		</div>
	)
}
