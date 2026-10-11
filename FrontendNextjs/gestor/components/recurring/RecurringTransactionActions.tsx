'use client'

import { Play, Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/shared/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { useProcessRecurringTransactionsMutation } from '@/hooks/queries/useRecurringTransactionsQuery'
import { useRecurringTransactionContext } from './RecurringTransactionContext'

/** Page-level actions of the recurring section (page header): run pending now + create. */
export function RecurringTransactionActions() {
	const t = useTranslations('recurring')
	const { setModalOpen, setEditingTransaction } = useRecurringTransactionContext()
	const processMutation = useProcessRecurringTransactionsMutation()
	const [isConfirmOpen, setConfirmOpen] = useState(false)

	const handleNew = () => {
		setEditingTransaction(null)
		setModalOpen(true)
	}

	// Resolves either way: the outcome is reported with a toast and the dialog closes.
	const handleConfirmProcess = async () => {
		try {
			await processMutation.mutateAsync()
			toast.success(t('processSuccess'), { description: t('processSuccessDescription') })
		} catch (error) {
			console.error(error)
			toast.error(t('processError'), { description: t('processErrorDescription') })
		}
	}

	return (
		<>
			<Button variant='outline' onClick={() => setConfirmOpen(true)} disabled={processMutation.isPending}>
				<Play className='mr-2 h-4 w-4' aria-hidden='true' />
				{t('runNow')}
			</Button>
			<Button onClick={handleNew}>
				<Plus className='mr-2 h-4 w-4' aria-hidden='true' />
				{t('newRecurring')}
			</Button>

			<ConfirmDialog
				open={isConfirmOpen}
				onOpenChange={setConfirmOpen}
				title={t('runTitle')}
				description={t('runDescription')}
				confirmLabel={t('confirmRun')}
				cancelLabel={t('cancel')}
				onConfirm={handleConfirmProcess}
			/>
		</>
	)
}
