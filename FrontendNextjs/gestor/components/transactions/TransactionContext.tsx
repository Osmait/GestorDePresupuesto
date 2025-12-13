'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { DateRange } from 'react-day-picker'
import { useSearchParams, useRouter } from 'next/navigation'
import { useTransactions } from '@/hooks/useRepositories'
import { TransactionFilters } from '@/types/transaction'

// Filter Type
export interface TransactionFiltersState {
    dateRange: DateRange
    type: string
    account: string
    category: string
    minAmount: string
    maxAmount: string
    search: string
}

interface TransactionContextType {
    filters: TransactionFiltersState
    setFilters: React.Dispatch<React.SetStateAction<TransactionFiltersState>>
    applyFilters: () => void
    clearFilters: () => void
    reloadCurrentView: () => void
    // Data
    transactions: any[] // Using any temporarily or import Transaction type
    pagination: any
    isLoading: boolean
    error: string | null
    createTransaction: (...args: any[]) => Promise<void>
    deleteTransaction: (id: string) => Promise<void>
}

const TransactionContext = createContext<TransactionContextType | undefined>(undefined)

export function TransactionProvider({ children }: { children: ReactNode }) {
    const searchParams = useSearchParams()
    const router = useRouter()
    // Removed duplicate useTransactions call

    const initializeFiltersFromURL = useCallback(() => {
        const dateFrom = searchParams.get('dateFrom')
        const dateTo = searchParams.get('dateTo')

        return {
            dateRange: {
                from: dateFrom ? new Date(dateFrom) : undefined,
                to: dateTo ? new Date(dateTo) : undefined,
            } as DateRange,
            type: searchParams.get('type') || 'all',
            account: searchParams.get('account') || 'all',
            category: searchParams.get('category') || 'all',
            minAmount: searchParams.get('minAmount') || '',
            maxAmount: searchParams.get('maxAmount') || '',
            search: searchParams.get('search') || '',
        }
    }, [searchParams])

    // Filter State
    const [filters, setFilters] = useState<TransactionFiltersState>(() => initializeFiltersFromURL())

    // Transactions State (Global for this page)
    const {
        transactions,
        pagination,
        isLoading: isLoadingTx,
        error: errorTx,
        loadTransactions,
        loadAllTransactions,
        createTransaction,
        deleteTransaction
    } = useTransactions()

    const updateURLWithFilters = useCallback((newFilters: TransactionFiltersState) => {
        const params = new URLSearchParams()

        if (newFilters.dateRange.from) params.set('dateFrom', newFilters.dateRange.from.toISOString().split('T')[0])
        if (newFilters.dateRange.to) params.set('dateTo', newFilters.dateRange.to.toISOString().split('T')[0])
        if (newFilters.type && newFilters.type !== 'all') params.set('type', newFilters.type)
        if (newFilters.account && newFilters.account !== 'all') params.set('account', newFilters.account)
        if (newFilters.category && newFilters.category !== 'all') params.set('category', newFilters.category)
        if (newFilters.minAmount) params.set('minAmount', newFilters.minAmount)
        if (newFilters.maxAmount) params.set('maxAmount', newFilters.maxAmount)
        if (newFilters.search) params.set('search', newFilters.search)

        const newURL = params.toString() ? `?${params.toString()}` : window.location.pathname
        router.replace(newURL)
    }, [router])

    const applyFilters = useCallback(() => {
        updateURLWithFilters(filters)

        const apiFilters: TransactionFilters = {
            page: 1, limit: 50, sort_by: 'created_at', sort_order: 'desc'
        }

        if (filters.dateRange.from && filters.dateRange.to) {
            apiFilters.date_from = filters.dateRange.from.toISOString().split('T')[0]
            apiFilters.date_to = filters.dateRange.to.toISOString().split('T')[0]
        }
        if (filters.type !== 'all') apiFilters.type = filters.type === 'INCOME' ? 'income' : 'bill'
        if (filters.account !== 'all') apiFilters.account_id = filters.account
        if (filters.category !== 'all') apiFilters.category_id = filters.category
        if (filters.minAmount) apiFilters.amount_min = Number(filters.minAmount)
        if (filters.maxAmount) apiFilters.amount_max = Number(filters.maxAmount)
        if (filters.search) apiFilters.search = filters.search

        loadTransactions(apiFilters)
    }, [filters, updateURLWithFilters, loadTransactions])

    const clearFilters = useCallback(() => {
        const clearedFilters = {
            dateRange: { from: undefined, to: undefined },
            type: 'all', account: 'all', category: 'all', minAmount: '', maxAmount: '', search: '',
        }
        setFilters(clearedFilters)
        router.replace(window.location.pathname)
        loadAllTransactions()
    }, [router, loadAllTransactions])

    const reloadCurrentView = useCallback(() => {
        const hasActiveFilters = searchParams.toString().length > 0
        if (hasActiveFilters) {
            applyFilters()
        } else {
            loadAllTransactions()
        }
    }, [searchParams, applyFilters, loadAllTransactions])

    // Initial Load Logic
    useEffect(() => {
        const hasActiveFilters = searchParams.toString().length > 0
        if (hasActiveFilters) {
            applyFilters()
        } else {
            // Ensure data is loaded initially
            loadAllTransactions()
        }
    }, [])

    return (
        <TransactionContext.Provider value={{
            filters,
            setFilters,
            applyFilters,
            clearFilters,
            reloadCurrentView,
            // Expose Data
            transactions,
            pagination,
            isLoading: isLoadingTx,
            error: errorTx,
            createTransaction,
            deleteTransaction
        }}>
            {children}
        </TransactionContext.Provider>
    )
}

export function useTransactionContext() {
    const context = useContext(TransactionContext)
    if (!context) {
        throw new Error('useTransactionContext must be used within a TransactionProvider')
    }
    return context
}
