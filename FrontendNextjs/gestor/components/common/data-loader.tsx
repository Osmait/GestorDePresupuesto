'use client'

import { useState, useEffect, ReactNode } from 'react'
import {
	getAuthRepository,
	getAccountRepository,
	getTransactionRepository,
	getCategoryRepository,
	getBudgetRepository
} from '@/lib/repositoryConfig'
import { User } from '@/types/user'
import { Account } from '@/types/account'
import { Transaction } from '@/types/transaction'
import { Category } from '@/types/category'
import { Budget } from '@/types/budget'

interface DataLoaderProps {
	children: (data: {
		user: User | null
		accounts: Account[]
		transactions: Transaction[]
		categories: Category[]
		budgets: Budget[]
		isLoading: boolean
		error: string | null
	}) => ReactNode
}

export function DataLoader({ children }: DataLoaderProps) {
	const [user, setUser] = useState<User | null>(null)
	const [accounts, setAccounts] = useState<Account[]>([])
	const [transactions, setTransactions] = useState<Transaction[]>([])
	const [categories, setCategories] = useState<Category[]>([])
	const [budgets, setBudgets] = useState<Budget[]>([])
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		const loadAllData = async () => {
			try {
				console.log('🔄 DataLoader: Cargando todos los datos...')

				const authRepository = await getAuthRepository()
				const accountRepository = await getAccountRepository()
				const transactionRepository = await getTransactionRepository()
				const categoryRepository = await getCategoryRepository()
				const budgetRepository = await getBudgetRepository()

				const [userData, accountsData, transactionsData, categoriesData, budgetsData] = await Promise.all([
					authRepository.login('juan.perez@example.com', 'password123'),
					accountRepository.findAll(),
					transactionRepository.findAll(),
					categoryRepository.findAll(),
					budgetRepository.findAll()
				])

				setUser(userData)
				setAccounts(accountsData)
				setTransactions(transactionsData.data)
				setCategories(categoriesData)
				setBudgets(budgetsData)

				console.log('✅ DataLoader: Todos los datos cargados exitosamente')
			} catch (err) {
				console.error('❌ DataLoader: Error cargando datos:', err)
				setError(err instanceof Error ? err.message : 'Error desconocido')
			} finally {
				setIsLoading(false)
			}
		}

		const timeoutId = setTimeout(() => {
			console.log('⏰ DataLoader: Timeout alcanzado, forzando fin de carga')
			setIsLoading(false)
		}, 10000)

		loadAllData().finally(() => {
			clearTimeout(timeoutId)
		})

		return () => clearTimeout(timeoutId)
	}, [])

	return <>{children({ user, accounts, transactions, categories, budgets, isLoading, error })}</>
} 