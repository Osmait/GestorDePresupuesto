'use client'

import { Loader2, Play, Plus } from 'lucide-react'
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
	const { setModalOpen, setEditingTransaction } = useRecurringTransactionContext()
	const processMutation = useProcessRecurringTransactionsMutation()
	const [isConfirmOpen, setConfirmOpen] = useState(false)

	const handleNew = () => {
		setEditingTransaction(null)
		setModalOpen(true)
	}

	const unconfirmedProcess = () => {
		setConfirmOpen(true)
	}

	const handleConfirmProcess = async () => {
		processMutation.mutate(undefined, {
			onSuccess: (_data) => {
				toast.success('Transacciones procesadas correctamente', {
					description: 'Se han generado las transacciones pendientes.',
				})
				setConfirmOpen(false)
			},
			onError: (error) => {
				console.error(error)
				toast.error('Error al procesar', {
					description: 'Hubo un problema al generar las transacciones.',
				})
				setConfirmOpen(false)
			},
		})
	}

	return (
		<>
			<div className='flex justify-end mb-4 space-x-2'>
				<Button variant='outline' onClick={unconfirmedProcess} disabled={processMutation.isPending}>
					<Play className='mr-2 h-4 w-4' />
					Ejecutar Ahora
				</Button>
				<Button onClick={handleNew}>
					<Plus className='mr-2 h-4 w-4' />
					Nueva Recurrente
				</Button>
			</div>

			<Dialog open={isConfirmOpen} onOpenChange={setConfirmOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Ejecutar Transacciones Recurrentes</DialogTitle>
						<DialogDescription>
							¿Estás seguro de que deseas procesar todas las transacciones recurrentes pendientes hasta la fecha de hoy?
							Esto generará automáticamente los gastos e ingresos programados.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<DialogClose asChild>
							<Button variant='outline'>Cancelar</Button>
						</DialogClose>
						<Button onClick={handleConfirmProcess} disabled={processMutation.isPending}>
							{processMutation.isPending && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}
							Confirmar Ejecución
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	)
}
