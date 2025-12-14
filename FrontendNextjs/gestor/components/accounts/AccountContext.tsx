'use client'

import { createContext, useContext, ReactNode } from 'react'
import { useGetAccounts, useCreateAccountMutation, useUpdateAccountMutation, useDeleteAccountMutation } from '@/hooks/queries/useAccountsQuery'
import { Account } from '@/types/account'

interface AccountContextType {
    accounts: Account[]
    isLoading: boolean
    error: string | null
    createAccount: (name: string, bank: string, initial_balance: number) => Promise<void>
    updateAccount: (id: string, name: string, bank: string) => Promise<void>
    deleteAccount: (id: string) => Promise<void>
    addAccount: (acc: Account) => void
    refetch: () => Promise<void>
}

const AccountContext = createContext<AccountContextType | undefined>(undefined)

export function AccountProvider({ children }: { children: ReactNode }) {
    // React Query Hooks
    const { data: accounts = [], isLoading, error: queryError, refetch } = useGetAccounts()
    const createMutation = useCreateAccountMutation()
    const updateMutation = useUpdateAccountMutation()
    const deleteMutation = useDeleteAccountMutation()

    const error = queryError ? (queryError as Error).message : null

    const createAccount = async (name: string, bank: string, initial_balance: number) => {
        await createMutation.mutateAsync({ name, bank, initial_balance })
    }

    const updateAccount = async (id: string, name: string, bank: string) => {
        await updateMutation.mutateAsync({ id, name, bank })
    }

    const deleteAccount = async (id: string) => {
        await deleteMutation.mutateAsync(id)
    }

    const addAccount = () => {
        // No-op: Cache invalidation handles this
    }

    return (
        <AccountContext.Provider value={{
            accounts,
            isLoading,
            error,
            createAccount,
            updateAccount,
            deleteAccount,
            addAccount,
            refetch: async () => { await refetch() }
        }}>
            {children}
        </AccountContext.Provider>
    )
}

export function useAccountContext() {
    const context = useContext(AccountContext)
    if (!context) {
        throw new Error('useAccountContext must be used within an AccountProvider')
    }
    return context
}
