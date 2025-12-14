import { useState, useEffect, useCallback } from 'react'
import { User } from '@/types/user'
import { CategoryExpense, MonthlySummary } from '@/types/analytics'
import {
	getAuthRepository,
	getAnalyticsRepository,
} from '@/lib/repositoryConfig'

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
	const [isLoadingCategoryExpenses, setIsLoadingCategoryExpenses] = useState(true)
	const [isLoadingMonthlySummary, setIsLoadingMonthlySummary] = useState(true)
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
