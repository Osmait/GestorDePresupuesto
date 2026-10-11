'use client'

import { useTranslations } from 'next-intl'
import { AccountActions } from '@/components/accounts/AccountActions'
import { AccountProvider } from '@/components/accounts/AccountContext'
import AccountsClient from '@/components/accounts/AccountsClient'
import { PageHeader } from '@/components/shared/PageHeader'
import { PageShell } from '@/components/shared/PageShell'

export default function AccountsPage() {
	const t = useTranslations('accounts')
	return (
		<AccountProvider>
			<PageShell>
				<div id='accounts-header'>
					<PageHeader
						title={t('title')}
						description={t('subtitle')}
						actionsId='add-account-btn'
						actions={<AccountActions />}
					/>
				</div>

				<div id='accounts-list'>
					<AccountsClient />
				</div>
			</PageShell>
		</AccountProvider>
	)
}
