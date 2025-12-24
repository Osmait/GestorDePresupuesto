'use client'
import { createContext, useContext, ReactNode, useState } from 'react'
import { useGetBudgets, useCreateBudgetMutation, useDeleteBudgetMutation, useUpdateBudgetMutation } from '@/hooks/queries/useBudgetsQuery'
import { Budget } from '@/types/budget'

interface BudgetContextType {
    budgets: Budget[]
    isLoading: boolean
    error: string | null
    createBudget: (categoryId: string, amount: number) => Promise<void>
    updateBudget: (id: string, categoryId: string, amount: number) => Promise<void>
    deleteBudget: (id: string) => Promise<void>
    refetch: () => Promise<void>
    editingBudget: Budget | null
    setEditingBudget: (budget: Budget | null) => void
    isModalOpen: boolean
    setModalOpen: (open: boolean) => void
}

const BudgetContext = createContext<BudgetContextType | undefined>(undefined)

export function BudgetProvider({ children }: { children: ReactNode }) {
    // React Query Hooks
    const { data: budgets = [], isLoading, error: queryError, refetch } = useGetBudgets()
    const createMutation = useCreateBudgetMutation()
    const deleteMutation = useDeleteBudgetMutation()
    const updateMutation = useUpdateBudgetMutation()

    // Global State
    const [editingBudget, setEditingBudget] = useState<Budget | null>(null)
    const [isModalOpen, setModalOpen] = useState(false)

    const error = queryError ? (queryError as Error).message : null

    const createBudget = async (categoryId: string, amount: number) => {
        await createMutation.mutateAsync({ categoryId, amount })
        setModalOpen(false)
    }

    const updateBudget = async (id: string, categoryId: string, amount: number) => {
        await updateMutation.mutateAsync({ id, categoryId, amount })
        setModalOpen(false)
        setEditingBudget(null)
    }

    const deleteBudget = async (id: string) => {
        await deleteMutation.mutateAsync(id)
    }

    return (
        <BudgetContext.Provider value={{
            budgets,
            isLoading,
            error,
            createBudget,
            updateBudget,
            deleteBudget,
            refetch: async () => { await refetch() },
            editingBudget,
            setEditingBudget,
            isModalOpen,
            setModalOpen
        }}>
            {children}
        </BudgetContext.Provider>
    )
}

export function useBudgetContext() {
    const context = useContext(BudgetContext)
    if (!context) {
        throw new Error('useBudgetContext must be used within a BudgetProvider')
    }
    return context
}
