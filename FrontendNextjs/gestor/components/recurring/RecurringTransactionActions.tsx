'use client'

import { Loader2, Play, Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog'
import { useProcessRecurringTransactionsMutation } from '@/hooks/queries/useRecurringTransactionsQuery'
import { useRecurringTransactionContext } from './RecurringTransactionContext'

export function RecurringTransactionActions() {
	const t = useTranslations('recurring')
	const { setModalOpen, setEditingTransaction } = useRecurringTransactionContext()
	const processMutation = useProcessRecurringTransactionsMutation()
	const [isConfirmOpen, setConfirmOpen] = useState(false)

	const handleNew = () => {
		setEditingTransaction(null)
		setModalOpen(true)
	}

	const handleConfirmProcess = async () => {
		processMutation.mutate(undefined, {
			onSuccess: () => {
				toast.success(t('processSuccess'), {
					description: t('processSuccessDescription'),
				})
				setConfirmOpen(false)
			},
			onError: (error) => {
				console.error(error)
				toast.error(t('processError'), {
					description: t('processErrorDescription'),
				})
				setConfirmOpen(false)
			},
		})
	}

	return (
		<>
			<div className='mb-4 flex flex-col gap-2 sm:flex-row sm:justify-end'>
				<Button variant='outline' onClick={() => setConfirmOpen(true)} disabled={processMutation.isPending}>
					<Play className='mr-2 h-4 w-4' />
					{t('runNow')}
				</Button>
				<Button onClick={handleNew}>
					<Plus className='mr-2 h-4 w-4' />
					{t('newRecurring')}
				</Button>
			</div>

			<Dialog open={isConfirmOpen} onOpenChange={setConfirmOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{t('runTitle')}</DialogTitle>
						<DialogDescription>{t('runDescription')}</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<DialogClose asChild>
							<Button variant='outline'>{t('cancel')}</Button>
						</DialogClose>
						<Button onClick={handleConfirmProcess} disabled={processMutation.isPending}>
							{processMutation.isPending && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
							{t('confirmRun')}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	)
}
