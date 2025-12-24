'use client'

import { createContext, useContext, useState, ReactNode } from 'react'
import { RecurringTransaction } from '@/types/recurringTransaction'

interface RecurringTransactionContextType {
    isModalOpen: boolean
    setModalOpen: (_isOpen: boolean) => void
    editingTransaction: RecurringTransaction | null
    setEditingTransaction: (_transaction: RecurringTransaction | null) => void
}

const RecurringTransactionContext = createContext<RecurringTransactionContextType | undefined>(undefined)

export function RecurringTransactionProvider({ children }: { children: ReactNode }) {
    const [isModalOpen, setModalOpen] = useState(false)
    const [editingTransaction, setEditingTransaction] = useState<RecurringTransaction | null>(null)

    return (
        <RecurringTransactionContext.Provider
            value={{
                isModalOpen,
                setModalOpen,
                editingTransaction,
                setEditingTransaction
            }}
        >
            {children}
        </RecurringTransactionContext.Provider>
    )
}

export function useRecurringTransactionContext() {
    const context = useContext(RecurringTransactionContext)
    if (context === undefined) {
        throw new Error('useRecurringTransactionContext must be used within a RecurringTransactionProvider')
    }
    return context
}
