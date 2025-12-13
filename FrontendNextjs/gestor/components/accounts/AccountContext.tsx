'use client'

import { createContext, useContext, ReactNode } from 'react'
import { useAccounts } from '@/hooks/useRepositories'
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
    const {
        accounts,
        isLoading,
        error,
        createAccount,
        updateAccount,
        deleteAccount,
        addAccount,
        refetch
    } = useAccounts()

    return (
        <AccountContext.Provider value={{
            accounts,
            isLoading,
            error,
            createAccount,
            updateAccount,
            deleteAccount,
            addAccount,
            refetch
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
