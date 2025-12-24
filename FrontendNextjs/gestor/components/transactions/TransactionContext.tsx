'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { DateRange } from 'react-day-picker'
import { useRouter } from 'next/navigation'
import { useGetTransactions, useCreateTransactionMutation, useDeleteTransactionMutation, useUpdateTransactionMutation } from '@/hooks/queries/useTransactionsQuery'
import { TransactionFilters } from '@/types/transaction'

// Filter Type
export interface TransactionFiltersState {
    dateRange: DateRange
    type: string
    account: string
    category: string
    budget: string
    minAmount: string
    maxAmount: string
    search: string
    sortBy: string
    sortOrder: 'asc' | 'desc'
}

interface TransactionContextType {
    filters: TransactionFiltersState
    setFilters: React.Dispatch<React.SetStateAction<TransactionFiltersState>>
    clearFilters: () => void
    reloadCurrentView: () => void
    // Data
    transactions: any[]
    pagination: any
    isLoading: boolean
    error: string | null
    createTransaction: (...args: any[]) => Promise<void>
    updateTransaction: (id: string, ...args: any[]) => Promise<void>
    deleteTransaction: (id: string) => Promise<void>
    editingTransaction: any | null
    setEditingTransaction: (tx: any | null) => void
    isModalOpen: boolean
    setModalOpen: (open: boolean) => void
}

export const TransactionContext = createContext<TransactionContextType | undefined>(undefined)

export function TransactionProvider({ children }: { children: ReactNode }) {
    const router = useRouter()

    // Filter State
    const [filters, setFilters] = useState<TransactionFiltersState>({
        dateRange: { from: undefined, to: undefined },
        type: 'all',
        account: 'all',
        category: 'all',
        budget: 'all',
        minAmount: '',
        maxAmount: '',
        search: '',
        sortBy: 'created_at',
        sortOrder: 'desc',
    })

    // React Query Hooks
    const [activeFilters, setActiveFilters] = useState<TransactionFilters>({})

    const updateURLWithFilters = useCallback((newFilters: TransactionFiltersState) => {
        const params = new URLSearchParams()

        if (newFilters.dateRange.from) params.set('dateFrom', newFilters.dateRange.from.toISOString().split('T')[0])
        if (newFilters.dateRange.to) params.set('dateTo', newFilters.dateRange.to.toISOString().split('T')[0])
        if (newFilters.type && newFilters.type !== 'all') params.set('type', newFilters.type)
        if (newFilters.account && newFilters.account !== 'all') params.set('account', newFilters.account)
        if (newFilters.category && newFilters.category !== 'all') params.set('category', newFilters.category)
        if (newFilters.budget && newFilters.budget !== 'all') params.set('budget', newFilters.budget)
        if (newFilters.minAmount) params.set('minAmount', newFilters.minAmount)
        if (newFilters.maxAmount) params.set('maxAmount', newFilters.maxAmount)
        if (newFilters.search) params.set('search', newFilters.search)
        if (newFilters.sortBy && newFilters.sortBy !== 'created_at') params.set('sortBy', newFilters.sortBy)
        if (newFilters.sortOrder && newFilters.sortOrder !== 'desc') params.set('sortOrder', newFilters.sortOrder)

        const newURL = params.toString() ? `?${params.toString()}` : window.location.pathname
        router.replace(newURL, { scroll: false })
    }, [router])

    // Map Context Filters -> API Filters
    useEffect(() => {
        const apiFilters: TransactionFilters = {
            page: 1, limit: 50, sort_by: (filters.sortBy as any) || 'created_at', sort_order: filters.sortOrder || 'desc'
        }

        if (filters.dateRange.from && filters.dateRange.to) {
            apiFilters.date_from = filters.dateRange.from.toISOString().split('T')[0]
            apiFilters.date_to = filters.dateRange.to.toISOString().split('T')[0]
        }
        if (filters.type !== 'all') apiFilters.type = filters.type === 'INCOME' ? 'income' : 'bill'
        if (filters.account !== 'all') apiFilters.account_id = filters.account
        if (filters.category !== 'all') apiFilters.category_id = filters.category
        if (filters.budget !== 'all') apiFilters.budget_id = filters.budget
        if (filters.minAmount) apiFilters.amount_min = Number(filters.minAmount)
        if (filters.maxAmount) apiFilters.amount_max = Number(filters.maxAmount)
        if (filters.search) apiFilters.search = filters.search

        setActiveFilters(apiFilters)
        updateURLWithFilters(filters)
    }, [filters, updateURLWithFilters])

    // Query Data
    const { data, isLoading: isLoadingTx, error: errorTx, refetch } = useGetTransactions(activeFilters)

    // Mutations
    const createMutation = useCreateTransactionMutation()
    const deleteMutation = useDeleteTransactionMutation()
    const updateMutation = useUpdateTransactionMutation()

    // Edit State
    const [editingTransaction, setEditingTransaction] = useState<any | null>(null)
    const [isModalOpen, setModalOpen] = useState(false)

    // Adapters for Legacy Interface
    const transactions = data?.transactions || []
    const pagination = data?.pagination || null

    const createTransaction = async (...args: any[]) => {
        const [name, description, amount, type, accountId, categoryId, budgetId, createdAt] = args
        await createMutation.mutateAsync({
            name, description, amount, type, accountId, categoryId, budgetId, createdAt
        })
    }

    const updateTransaction = async (id: string, ...args: any[]) => {
        const [name, description, amount, type, accountId, categoryId, budgetId, createdAt] = args
        await updateMutation.mutateAsync({
            id, name, description, amount, type, accountId, categoryId, budgetId, createdAt
        })
        setEditingTransaction(null)
    }

    const deleteTransaction = async (id: string) => {
        await deleteMutation.mutateAsync(id)
    }

    const loadAllTransactions = useCallback(() => refetch(), [refetch])

    const clearFilters = useCallback(() => {
        const clearedFilters = {
            dateRange: { from: undefined, to: undefined },
            type: 'all', account: 'all', category: 'all', budget: 'all', minAmount: '', maxAmount: '', search: '',
            sortBy: 'created_at', sortOrder: 'desc' as 'asc' | 'desc'
        }
        setFilters(clearedFilters)
        router.replace(window.location.pathname)
    }, [router])

    const reloadCurrentView = useCallback(() => {
        loadAllTransactions()
    }, [loadAllTransactions])

    return (
        <TransactionContext.Provider value={{
            filters,
            setFilters,
            clearFilters,
            reloadCurrentView,
            transactions,
            pagination,
            isLoading: isLoadingTx,
            error: errorTx ? (errorTx as Error).message : null,
            createTransaction,
            updateTransaction,
            deleteTransaction,
            editingTransaction,
            setEditingTransaction,
            isModalOpen,
            setModalOpen,
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
