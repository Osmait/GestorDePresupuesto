'use client'

import { useSearchParams } from 'next/navigation'
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { DateRange } from 'react-day-picker'
import {
	useCreateTransactionMutation,
	useDeleteTransactionMutation,
	useGetTransactions,
	useUpdateTransactionMutation,
} from '@/hooks/queries/useTransactionsQuery'
import { formatCalendarDate, getAppMonthRange } from '@/lib/app-time'
import { moneyInputToNumber } from '@/lib/money-input'
import { TransactionFilters, TransactionSummary } from '@/types/transaction'

function parseDateFromParam(value: string | null): Date | undefined {
	if (!value) return undefined
	const date = new Date(`${value}T00:00:00`)
	if (Number.isNaN(date.getTime())) return undefined
	return date
}

function buildInitialFiltersFromURL(searchParams: URLSearchParams): TransactionFiltersState {
	const from = parseDateFromParam(searchParams.get('dateFrom'))
	const to = parseDateFromParam(searchParams.get('dateTo'))
	// Default: the current month in Santo Domingo, not in the browser's zone.
	const defaultRange = getAppMonthRange()

	return {
		dateRange: { from: from || defaultRange.from, to: to || defaultRange.to },
		type: searchParams.get('type') || 'all',
		account: searchParams.get('account') || 'all',
		category: searchParams.get('category') || 'all',
		budget: searchParams.get('budget') || 'all',
		minAmount: searchParams.get('minAmount') || '',
		maxAmount: searchParams.get('maxAmount') || '',
		search: searchParams.get('search') || '',
		sortBy: searchParams.get('sortBy') || 'created_at',
		sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc',
	}
}

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

const FILTER_URL_KEYS = [
	'dateFrom',
	'dateTo',
	'type',
	'account',
	'category',
	'budget',
	'minAmount',
	'maxAmount',
	'search',
	'sortBy',
	'sortOrder',
] as const

function buildApiFilters(filters: TransactionFiltersState): TransactionFilters {
	const apiFilters: TransactionFilters = {
		page: 1,
		limit: 50,
		sort_by: (filters.sortBy as any) || 'created_at',
		sort_order: filters.sortOrder || 'desc',
		include_summary: true,
	}

	if (filters.dateRange.from && filters.dateRange.to) {
		apiFilters.date_from = formatCalendarDate(filters.dateRange.from)
		apiFilters.date_to = formatCalendarDate(filters.dateRange.to)
	}
	if (filters.type !== 'all') apiFilters.type = filters.type === 'INCOME' ? 'income' : 'bill'
	if (filters.account !== 'all') apiFilters.account_id = filters.account
	if (filters.category !== 'all') apiFilters.category_id = filters.category
	if (filters.budget !== 'all') apiFilters.budget_id = filters.budget
	// Amount filters are typed text ("1,500" or "1500,50"); an unparseable one is ignored.
	const minAmount = moneyInputToNumber(filters.minAmount)
	const maxAmount = moneyInputToNumber(filters.maxAmount)
	if (Number.isFinite(minAmount)) apiFilters.amount_min = minAmount
	if (Number.isFinite(maxAmount)) apiFilters.amount_max = maxAmount
	if (filters.search) apiFilters.search = filters.search

	return apiFilters
}

/**
 * Writes the filters into the current query string. Only the filter keys are
 * managed: other parameters (e.g. `highlight`/`open` deep links) are kept.
 */
function buildURLWithFilters(filters: TransactionFiltersState): string {
	const params = new URLSearchParams(window.location.search)
	for (const key of FILTER_URL_KEYS) params.delete(key)

	if (filters.dateRange.from) params.set('dateFrom', formatCalendarDate(filters.dateRange.from))
	if (filters.dateRange.to) params.set('dateTo', formatCalendarDate(filters.dateRange.to))
	if (filters.type && filters.type !== 'all') params.set('type', filters.type)
	if (filters.account && filters.account !== 'all') params.set('account', filters.account)
	if (filters.category && filters.category !== 'all') params.set('category', filters.category)
	if (filters.budget && filters.budget !== 'all') params.set('budget', filters.budget)
	if (filters.minAmount) params.set('minAmount', filters.minAmount)
	if (filters.maxAmount) params.set('maxAmount', filters.maxAmount)
	if (filters.search) params.set('search', filters.search)
	if (filters.sortBy && filters.sortBy !== 'created_at') params.set('sortBy', filters.sortBy)
	if (filters.sortOrder && filters.sortOrder !== 'desc') params.set('sortOrder', filters.sortOrder)

	const query = params.toString()
	return query ? `${window.location.pathname}?${query}` : window.location.pathname
}

/** Values that change with the filters or the data. */
export interface TransactionStateContextType {
	filters: TransactionFiltersState
	transactions: any[]
	pagination: any
	summary: TransactionSummary | null
	isLoading: boolean
	error: string | null
	editingTransaction: any | null
	isModalOpen: boolean
}

/** Referentially stable callbacks: consumers of only these never re-render on data changes. */
export interface TransactionActionsContextType {
	setFilters: React.Dispatch<React.SetStateAction<TransactionFiltersState>>
	clearFilters: () => void
	reloadCurrentView: () => void
	createTransaction: (..._args: any[]) => Promise<void>
	updateTransaction: (_id: string, ..._args: any[]) => Promise<void>
	deleteTransaction: (_id: string) => Promise<void>
	setEditingTransaction: (_tx: any | null) => void
	setModalOpen: (_open: boolean) => void
}

export type TransactionContextType = TransactionStateContextType & TransactionActionsContextType

export const TransactionStateContext = createContext<TransactionStateContextType | undefined>(undefined)
export const TransactionActionsContext = createContext<TransactionActionsContextType | undefined>(undefined)

export function TransactionProvider({
	children,
	syncUrl = true,
	fetchTransactions = true,
}: {
	children: ReactNode
	/**
	 * Mirror the filters into the URL query string. Disable it when the provider
	 * is mounted outside the transactions page (e.g. the global "+" modal), or it
	 * would rewrite the URL of whatever page the user is on.
	 */
	syncUrl?: boolean
	/** Load the filtered list. The global "+" modal only needs the mutations. */
	fetchTransactions?: boolean
}) {
	const searchParams = useSearchParams()

	// Filter State
	const [filters, setFilters] = useState<TransactionFiltersState>(() => buildInitialFiltersFromURL(searchParams))

	// Context filters -> API filters. Derived during render (not in an effect), so
	// the first request already carries the real filters.
	const apiFilters = useMemo(() => buildApiFilters(filters), [filters])

	// Mirror the filters into the URL without a server round trip: Next.js syncs
	// `window.history.replaceState` with useSearchParams, while router.replace
	// would re-render the (dynamic) page on the server for every change.
	useEffect(() => {
		if (!syncUrl) return
		const url = buildURLWithFilters(filters)
		if (url !== `${window.location.pathname}${window.location.search}`) {
			window.history.replaceState(window.history.state, '', url)
		}
	}, [filters, syncUrl])

	// Query Data
	const {
		data,
		isLoading: isLoadingTx,
		error: errorTx,
		refetch,
	} = useGetTransactions(apiFilters, { enabled: fetchTransactions })

	// Mutations (mutateAsync is stable across renders)
	const { mutateAsync: createAsync } = useCreateTransactionMutation()
	const { mutateAsync: deleteAsync } = useDeleteTransactionMutation()
	const { mutateAsync: updateAsync } = useUpdateTransactionMutation()

	// Edit State
	const [editingTransaction, setEditingTransaction] = useState<any | null>(null)
	const [isModalOpen, setModalOpen] = useState(false)

	const createTransaction = useCallback(
		async (...args: any[]) => {
			const [name, description, amount, type, accountId, categoryId, budgetId, currency, createdAt] = args
			await createAsync({
				name,
				description,
				amount,
				type,
				accountId,
				categoryId,
				budgetId,
				currency,
				createdAt,
			})
		},
		[createAsync],
	)

	const updateTransaction = useCallback(
		async (id: string, ...args: any[]) => {
			const [name, description, amount, type, accountId, categoryId, budgetId, currency, createdAt] = args
			await updateAsync({
				id,
				name,
				description,
				amount,
				type,
				accountId,
				categoryId,
				budgetId,
				currency,
				createdAt,
			})
			setEditingTransaction(null)
		},
		[updateAsync],
	)

	const deleteTransaction = useCallback(
		async (id: string) => {
			await deleteAsync(id)
		},
		[deleteAsync],
	)

	const clearFilters = useCallback(() => {
		setFilters({
			dateRange: getAppMonthRange(),
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
	}, [])

	const reloadCurrentView = useCallback(() => {
		refetch()
	}, [refetch])

	const actions = useMemo<TransactionActionsContextType>(
		() => ({
			setFilters,
			clearFilters,
			reloadCurrentView,
			createTransaction,
			updateTransaction,
			deleteTransaction,
			setEditingTransaction,
			setModalOpen,
		}),
		[clearFilters, reloadCurrentView, createTransaction, updateTransaction, deleteTransaction],
	)

	const transactions = data?.transactions
	const pagination = data?.pagination || null
	const summary = data?.summary || null
	const error = errorTx ? (errorTx as Error).message : null

	const state = useMemo<TransactionStateContextType>(
		() => ({
			filters,
			transactions: transactions || EMPTY_TRANSACTIONS,
			pagination,
			summary,
			isLoading: isLoadingTx,
			error,
			editingTransaction,
			isModalOpen,
		}),
		[filters, transactions, pagination, summary, isLoadingTx, error, editingTransaction, isModalOpen],
	)

	return (
		<TransactionActionsContext.Provider value={actions}>
			<TransactionStateContext.Provider value={state}>{children}</TransactionStateContext.Provider>
		</TransactionActionsContext.Provider>
	)
}

const EMPTY_TRANSACTIONS: any[] = []

/** Stable callbacks only (does not re-render when the list or the filters change). */
export function useTransactionActions() {
	const context = useContext(TransactionActionsContext)
	if (!context) {
		throw new Error('useTransactionActions must be used within a TransactionProvider')
	}
	return context
}

/** Filters, data and callbacks. Re-renders whenever the filters or the data change. */
export function useTransactionContext(): TransactionContextType {
	const state = useContext(TransactionStateContext)
	const actions = useContext(TransactionActionsContext)
	const context = useMemo(() => (state && actions ? { ...state, ...actions } : undefined), [state, actions])
	if (!context) {
		throw new Error('useTransactionContext must be used within a TransactionProvider')
	}
	return context
}
