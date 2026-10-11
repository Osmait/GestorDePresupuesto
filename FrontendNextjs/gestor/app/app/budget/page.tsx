'use client'

import { useTranslations } from 'next-intl'
import { BudgetActions } from '@/components/budgets/BudgetActions'
import { BudgetProvider } from '@/components/budgets/BudgetContext'
import { BudgetList } from '@/components/budgets/BudgetList'
import { PageHeader } from '@/components/shared/PageHeader'
import { PageShell } from '@/components/shared/PageShell'

export default function BudgetPage() {
	const t = useTranslations('budgets')
	return (
		<BudgetProvider>
			<PageShell>
				<div id='budgets-header'>
					<PageHeader
						title={t('title')}
						description={t('subtitle')}
						actionsId='add-budget-btn'
						actions={<BudgetActions />}
					/>
				</div>

				<div id='budgets-list'>
					<BudgetList />
				</div>
			</PageShell>
		</BudgetProvider>
	)
}
