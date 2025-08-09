import { useState, useEffect, useCallback } from 'react'
import { Account } from '@/types/account'
import { Category } from '@/types/category'
import { Transaction, TypeTransaction, PaginatedTransactionResponse, TransactionFilters, PaginationMeta } from '@/types/transaction'
import { Budget } from '@/types/budget'
import { User } from '@/types/user'
import { CategoryExpense, MonthlySummary } from '@/types/analytics'
import {
	getAccountRepository,
	getAuthRepository,
	getBudgetRepository,
	getCategoryRepository,
	getTransactionRepository,
	isMockMode,
	getAnalyticsRepository,
} from '@/lib/repositoryConfig'

export function useAccounts() {
	const [accounts, setAccounts] = useState<Account[]>([])
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const loadAccounts = useCallback(async () => {
		try {
			setIsLoading(true)
			setError(null)
			const accountRepository = await getAccountRepository()
			const data = await accountRepository.findAll()
			setAccounts(Array.isArray(data) ? [...data] : [])
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Error loading accounts')
		} finally {
			setIsLoading(false)
		}
	}, [])

	const createAccount = useCallback(async (
		name: string,
		bank: string,
		initial_balance: number
	) => {
		try {
			setError(null)
			const accountRepository = await getAccountRepository()
			await accountRepository.create(name, bank, initial_balance)
			await loadAccounts() // Recargar después de crear
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Error creating account')
			throw err
		}
	}, [loadAccounts])

	const updateAccount = useCallback(async (
		id: string,
		name: string,
		bank: string
	) => {
		try {
			setError(null)
			const accountRepository = await getAccountRepository()
			await accountRepository.update(id, name, bank)
			await loadAccounts() // Recargar después de actualizar
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Error updating account')
			throw err
		}
	}, [loadAccounts])

	const deleteAccount = useCallback(async (id: string) => {
		try {
			setError(null)
			const accountRepository = await getAccountRepository()
			await accountRepository.delete(id)
			await loadAccounts() // Recargar después de eliminar
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Error deleting account')
			throw err
		}
	}, [loadAccounts])

	useEffect(() => {
		loadAccounts()
	}, [loadAccounts])

	return {
		accounts,
		isLoading,
		error,
		createAccount,
		updateAccount,
		deleteAccount,
		refetch: loadAccounts,
	}
}

// Hook para manejar categorías
export const useCategories = () => {
	const [categories, setCategories] = useState<Category[]>([])
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const loadCategories = useCallback(async () => {
		try {
			setIsLoading(true)
			setError(null)
			const categoryRepository = await getCategoryRepository()
			const data = await categoryRepository.findAll()
			setCategories(Array.isArray(data) ? data : [])
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Error loading categories')
		} finally {
			setIsLoading(false)
		}
	}, [])

	const createCategory = useCallback(async (
		name: string,
		icon: string,
		color: string
	) => {
		try {
			setError(null)
			const categoryRepository = await getCategoryRepository()
			await categoryRepository.create(name, icon, color)
			await loadCategories() // Recargar después de crear
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Error creating category')
			throw err
		}
	}, [loadCategories])

	const deleteCategory = useCallback(async (id: string) => {
		try {
			setError(null)
			const categoryRepository = await getCategoryRepository()
			await categoryRepository.delete(id)
			await loadCategories() // Recargar después de eliminar
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Error deleting category')
			throw err
		}
	}, [loadCategories])

	useEffect(() => {
		loadCategories()
	}, [loadCategories])

	return {
		categories,
		isLoading,
		error,
		createCategory,
		deleteCategory,
		refetch: loadCategories,
	}
}

// Hook para manejar transacciones
export const useTransactions = () => {
	const [transactions, setTransactions] = useState<Transaction[]>([])
	const [pagination, setPagination] = useState<PaginationMeta | null>(null)
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const loadTransactions = useCallback(async (filters?: TransactionFilters) => {
		try {
			setIsLoading(true)
			setError(null)
			const transactionRepository = await getTransactionRepository()
			const response = await transactionRepository.findAll(filters)
			setTransactions(response.data || [])
			setPagination(response.pagination || null)
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Error loading transactions')
		} finally {
			setIsLoading(false)
		}
	}, [])

	const loadAllTransactions = useCallback(async () => {
		try {
			setIsLoading(true)
			setError(null)
			const transactionRepository = await getTransactionRepository()
			const data = await transactionRepository.findAllSimple()
			setTransactions(data || [])
			setPagination(null) // No pagination for simple load
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Error loading transactions')
		} finally {
			setIsLoading(false)
		}
	}, [])

	const createTransaction = useCallback(async (
		name: string,
		description: string,
		amount: number,
		type: TypeTransaction,
		accountId: string,
		categoryId: string,
		budgetId?: string
	) => {
		try {
			setError(null)
			const transactionRepository = await getTransactionRepository()
			await transactionRepository.create(
				name,
				description,
				amount,
				type,
				accountId,
				categoryId,
				budgetId
			)
			await loadAllTransactions() // Recargar después de crear
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Error creating transaction')
			throw err
		}
	}, [loadAllTransactions])

	const deleteTransaction = useCallback(async (id: string) => {
		try {
			setError(null)
			const transactionRepository = await getTransactionRepository()
			await transactionRepository.delete(id)
			await loadAllTransactions() // Recargar después de eliminar
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Error deleting transaction')
			throw err
		}
	}, [loadAllTransactions])

	// Métodos adicionales para mocks
	const getTransactionsByAccount = useCallback(async (accountId: string) => {
		if (!isMockMode()) {
			throw new Error('This method is only available in mock mode')
		}
		
		try {
			const transactionRepository = await getTransactionRepository()
			const mockRepo = transactionRepository as any
			return await mockRepo.findByAccount(accountId)
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Error filtering transactions')
			throw err
		}
	}, [])

	const getTransactionsByCategory = useCallback(async (categoryId: string) => {
		if (!isMockMode()) {
			throw new Error('This method is only available in mock mode')
		}
		
		try {
			const transactionRepository = await getTransactionRepository()
			const mockRepo = transactionRepository as any
			return await mockRepo.findByCategory(categoryId)
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Error filtering transactions')
			throw err
		}
	}, [])

	const getTransactionStatistics = useCallback(async () => {
		if (!isMockMode()) {
			throw new Error('This method is only available in mock mode')
		}
		
		try {
			const transactionRepository = await getTransactionRepository()
			const mockRepo = transactionRepository as any
			return await mockRepo.getStatistics()
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Error getting statistics')
			throw err
		}
	}, [])

	useEffect(() => {
		loadAllTransactions()
	}, [loadAllTransactions])

	return {
		transactions,
		pagination,
		isLoading,
		error,
		loadTransactions,
		loadAllTransactions,
		createTransaction,
		deleteTransaction,
		getTransactionsByAccount,
		getTransactionsByCategory,
		getTransactionStatistics,
		refetch: loadAllTransactions,
	}
}

// Hook para manejar presupuestos
export const useBudgets = () => {
	const [budgets, setBudgets] = useState<Budget[]>([])
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const loadBudgets = useCallback(async () => {
		try {
			setIsLoading(true)
			setError(null)
			const budgetRepository = await getBudgetRepository()
			const data = await budgetRepository.findAll()
			setBudgets(data)
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Error loading budgets')
		} finally {
			setIsLoading(false)
		}
	}, [])

	const createBudget = useCallback(async (
		categoryId: string,
		amount: number
	) => {
		try {
			setError(null)
			const budgetRepository = await getBudgetRepository()
			await budgetRepository.create(categoryId, amount)
			await loadBudgets() // Recargar después de crear
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Error creating budget')
			throw err
		}
	}, [loadBudgets])

	const deleteBudget = useCallback(async (id: string) => {
		try {
			setError(null)
			const budgetRepository = await getBudgetRepository()
			await budgetRepository.delete(id)
			await loadBudgets() // Recargar después de eliminar
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Error deleting budget')
			throw err
		}
	}, [loadBudgets])

	useEffect(() => {
		loadBudgets()
	}, [loadBudgets])

	return {
		budgets,
		isLoading,
		error,
		createBudget,
		deleteBudget,
		refetch: loadBudgets,
	}
}

// Hook para manejar autenticación
export const useAuth = () => {
	const [user, setUser] = useState<User | null>(null)
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const login = useCallback(async (email: string, password: string) => {
		try {
			setIsLoading(true)
			setError(null)
			const authRepository = await getAuthRepository()
			const userData = await authRepository.login(email, password)
			setUser(userData)
			return userData
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Login failed')
			throw err
		} finally {
			setIsLoading(false)
		}
	}, [])

	const signUp = useCallback(async (
		name: string,
		lastName: string,
		email: string,
		password: string
	) => {
		try {
			setIsLoading(true)
			setError(null)
			const authRepository = await getAuthRepository()
			await authRepository.signUp(name, lastName, email, password)
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Sign up failed')
			throw err
		} finally {
			setIsLoading(false)
		}
	}, [])

	const logout = useCallback(() => {
		setUser(null)
		setError(null)
	}, [])

	const getProfile = useCallback(async (token: string) => {
		try {
			setIsLoading(true)
			setError(null)
			const authRepository = await getAuthRepository()
			const userData = await authRepository.getProfile(token)
			setUser(userData)
			return userData
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to get profile')
			throw err
		} finally {
			setIsLoading(false)
		}
	}, [])

	return {
		user,
		isLoading,
		error,
		login,
		signUp,
		logout,
		getProfile,
	}
}

// Hook para manejar analíticas
export const useAnalytics = () => {
	const [categoryExpenses, setCategoryExpenses] = useState<CategoryExpense[]>([])
	const [monthlySummary, setMonthlySummary] = useState<MonthlySummary[]>([])
	const [isLoadingCategoryExpenses, setIsLoadingCategoryExpenses] = useState(false)
	const [isLoadingMonthlySummary, setIsLoadingMonthlySummary] = useState(false)
	const [error, setError] = useState<string | null>(null)

	const loadCategoryExpenses = useCallback(async () => {
		try {
			setIsLoadingCategoryExpenses(true)
			setError(null)
			const analyticsRepository = await getAnalyticsRepository()
			const data = await analyticsRepository.getCategoryExpenses()
			setCategoryExpenses(data)
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Error loading category expenses')
		} finally {
			setIsLoadingCategoryExpenses(false)
		}
	}, [])

	const loadMonthlySummary = useCallback(async () => {
		try {
			setIsLoadingMonthlySummary(true)
			setError(null)
			const analyticsRepository = await getAnalyticsRepository()
			const data = await analyticsRepository.getMonthlySummary()
			setMonthlySummary(data)
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Error loading monthly summary')
		} finally {
			setIsLoadingMonthlySummary(false)
		}
	}, [])

	const refetchAll = useCallback(async () => {
		await Promise.all([
			loadCategoryExpenses(),
			loadMonthlySummary()
		])
	}, [loadCategoryExpenses, loadMonthlySummary])

	return {
		categoryExpenses,
		monthlySummary,
		isLoadingCategoryExpenses,
		isLoadingMonthlySummary,
		error,
		loadCategoryExpenses,
		loadMonthlySummary,
		refetchAll
	}
}

// Hook combinado para dashboard
export const useDashboard = () => {
	const accounts = useAccounts()
	const categories = useCategories()
	const transactions = useTransactions()
	const budgets = useBudgets()
	const auth = useAuth()

	const isLoading = 
		accounts.isLoading || 
		categories.isLoading || 
		transactions.isLoading || 
		budgets.isLoading || 
		auth.isLoading

	const hasError = 
		accounts.error || 
		categories.error || 
		transactions.error || 
		budgets.error || 
		auth.error

	const refetchAll = useCallback(async () => {
		await Promise.all([
			accounts.refetch(),
			categories.refetch(),
			transactions.refetch(),
			budgets.refetch(),
		])
	}, [accounts.refetch, categories.refetch, transactions.refetch, budgets.refetch])

	return {
		accounts,
		categories,
		transactions,
		budgets,
		auth,
		isLoading,
		hasError,
		refetchAll,
	}
} 
