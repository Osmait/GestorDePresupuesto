'use client'

import { createContext, useContext, ReactNode } from 'react'
import { useBudgets } from '@/hooks/useRepositories'
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
    const {
        budgets,
        isLoading,
        error,
        createBudget,
        deleteBudget,
        refetch
    } = useBudgets()

    return (
        <BudgetContext.Provider value={{
            budgets,
            isLoading,
            error,
            createBudget,
            deleteBudget,
            refetch
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
