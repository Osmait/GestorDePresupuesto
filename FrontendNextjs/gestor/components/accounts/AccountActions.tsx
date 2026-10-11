'use client'

import { Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useAccountContext } from '@/components/accounts/AccountContext'
import { AccountFormModal } from '@/components/accounts/AccountFormModal'
import { Button } from '@/components/ui/button'

/** Page-level "New account" button and its dialog (state lives in AccountContext so the empty state can open it too). */
export function AccountActions() {
	const t = useTranslations('accounts')
	const { createAccount, isCreateOpen, setCreateOpen } = useAccountContext()

	return (
		<>
			<Button onClick={() => setCreateOpen(true)}>
				<Plus className='mr-2 h-4 w-4' aria-hidden='true' />
				{t('addAccount')}
			</Button>
			<AccountFormModal
				open={isCreateOpen}
				setOpen={setCreateOpen}
				createAccount={async (name, bank, initial_balance) => {
					// Rejections keep the dialog open with an inline error (AccountFormModal).
					await createAccount(name, bank, initial_balance)
					setCreateOpen(false)
				}}
				isLoading={false}
				error={null}
			/>
		</>
	)
}
