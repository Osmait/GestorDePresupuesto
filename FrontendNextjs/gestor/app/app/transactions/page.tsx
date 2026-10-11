'use client'

import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { RecurringTransactionActions } from '@/components/recurring/RecurringTransactionActions'
import { RecurringTransactionProvider } from '@/components/recurring/RecurringTransactionContext'
import { RecurringTransactionFormModal } from '@/components/recurring/RecurringTransactionFormModal'
import { RecurringTransactionList } from '@/components/recurring/RecurringTransactionList'
import { PageHeader } from '@/components/shared/PageHeader'
import { PageShell } from '@/components/shared/PageShell'
import { PageTabs } from '@/components/shared/PageTabs'
import { TransactionActions } from '@/components/transactions/TransactionActions'
import { TransactionProvider } from '@/components/transactions/TransactionContext'
import TransactionsList from '@/components/transactions/TransactionsList'

type Section = 'history' | 'recurring'

export default function TransactionsPage() {
	const t = useTranslations('transactions')
	const searchParams = useSearchParams()
	// The header actions follow the section, so the page owns it (PageTabs mirrors it in `?section=`).
	const [section, setSection] = useState<Section>(
		searchParams?.get('section') === 'recurring' ? 'recurring' : 'history',
	)

	return (
		<TransactionProvider>
			<RecurringTransactionProvider>
				<PageShell>
					{/* The ids are anchors for the demo tour (components/common/DemoTour.tsx). */}
					<div id='transactions-header'>
						<PageHeader
							title={t('title')}
							description={t('subtitle')}
							actionsId='add-transaction-btn'
							actions={section === 'history' ? <TransactionActions /> : <RecurringTransactionActions />}
						/>
					</div>

					{/* `section`, not `tab`: the history list's type filter already uses `?tab=`. */}
					<PageTabs
						id='transactions-tabs'
						urlParam='section'
						defaultValue='history'
						value={section}
						onValueChange={(value) => setSection(value as Section)}
						aria-label={t('sectionsLabel')}
						tabs={[
							{
								value: 'history',
								label: t('history'),
								content: (
									<div id='transactions-list'>
										<TransactionsList />
									</div>
								),
							},
							{ value: 'recurring', label: t('recurring'), content: <RecurringTransactionList /> },
						]}
					/>

					<RecurringTransactionFormModal />
				</PageShell>
			</RecurringTransactionProvider>
		</TransactionProvider>
	)
}
