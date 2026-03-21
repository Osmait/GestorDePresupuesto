'use client'

import { PlusCircle } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { useAccountContext } from '@/components/accounts/AccountContext'
import { AccountFormModal } from '@/components/accounts/AccountFormModal'
import { Button } from '@/components/ui/button'

export function AccountActions() {
	const t = useTranslations('accounts')
	const [modalOpen, setModalOpen] = useState(false)
	const { createAccount, isLoading, error } = useAccountContext()

	return (
		<div className='flex items-center gap-3'>
			<Button
				className='bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70'
				onClick={() => setModalOpen(true)}
			>
				<PlusCircle className='h-4 w-4 mr-2' />
				{t('addAccount')}
			</Button>
			<AccountFormModal
				open={modalOpen}
				setOpen={setModalOpen}
				createAccount={async (name, bank, initial_balance) => {
					setModalOpen(false)

					try {
						await createAccount(name, bank, initial_balance)
					} catch (e) {
						console.error('Failed to create account', e)
					}
				}}
				isLoading={isLoading}
				error={error}
			/>
		</div>
	)
}
