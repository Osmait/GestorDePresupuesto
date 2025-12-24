import { useState, useCallback } from 'react'
import { User } from '@/types/user'
import {
	getAuthRepository,
} from '@/lib/repositoryConfig'

// Hook para manejar autenticación
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
