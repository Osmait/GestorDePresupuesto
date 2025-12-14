'use client'

import { Button } from '@/components/ui/button'
import { Plus, Play } from 'lucide-react'
import { useRecurringTransactionContext } from './RecurringTransactionContext'
import { useProcessRecurringTransactionsMutation } from '@/hooks/queries/useRecurringTransactionsQuery'

export function RecurringTransactionActions() {
    const { setModalOpen, setEditingTransaction } = useRecurringTransactionContext()
    const processMutation = useProcessRecurringTransactionsMutation()

    const handleNew = () => {
        setEditingTransaction(null)
        setModalOpen(true)
    }

    const handleProcess = async () => {
        processMutation.mutate(undefined, {
            onSuccess: () => {
                alert("Procesado: Las transacciones recurrentes pendientes han sido ejecutadas.")
            },
            onError: () => {
                alert("Error: Hubo un error al procesar las transacciones.")
            }
        })
    }

    return (
        <div className="flex justify-end mb-4 space-x-2">
            <Button variant="outline" onClick={handleProcess} disabled={processMutation.isPending}>
                <Play className="mr-2 h-4 w-4" />
                {processMutation.isPending ? 'Ejecutando...' : 'Ejecutar Ahora'}
            </Button>
            <Button onClick={handleNew}>
                <Plus className="mr-2 h-4 w-4" />
                Nueva Recurrente
            </Button>
        </div>
    )
}
