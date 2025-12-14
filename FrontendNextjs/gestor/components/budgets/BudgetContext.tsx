'use client'

import { createContext, useContext, ReactNode } from 'react'
import { useGetBudgets, useCreateBudgetMutation, useDeleteBudgetMutation } from '@/hooks/queries/useBudgetsQuery'
import { Budget } from '@/types/budget'

interface BudgetContextType {
    budgets: Budget[]
    isLoading: boolean
    error: string | null
    createBudget: (categoryId: string, amount: number) => Promise<void>
    deleteBudget: (id: string) => Promise<void>
    refetch: () => Promise<void>
}

const BudgetContext = createContext<BudgetContextType | undefined>(undefined)

export function BudgetProvider({ children }: { children: ReactNode }) {
    // React Query Hooks
    const { data: budgets = [], isLoading, error: queryError, refetch } = useGetBudgets()
    const createMutation = useCreateBudgetMutation()
    const deleteMutation = useDeleteBudgetMutation()

    const error = queryError ? (queryError as Error).message : null

    const createBudget = async (categoryId: string, amount: number) => {
        await createMutation.mutateAsync({ categoryId, amount })
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
            deleteBudget,
            refetch: async () => { await refetch() }
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
