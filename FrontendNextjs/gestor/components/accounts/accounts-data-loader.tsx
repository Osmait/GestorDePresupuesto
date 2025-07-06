'use client'

import { useState, useEffect, ReactNode } from 'react'
import { getAccountRepository } from '@/lib/repositoryConfig'
import { Account } from '@/types/account'

interface AccountsDataLoaderProps {
	children: (data: {
		accounts: Account[]
		isLoading: boolean
		error: string | null
	}) => ReactNode
}

export function AccountsDataLoader({ children }: AccountsDataLoaderProps) {
	const [accounts, setAccounts] = useState<Account[]>([])
	const [isLoading, setIsLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)

	useEffect(() => {
		const loadAccounts = async () => {
			try {
				console.log('🔄 AccountsDataLoader: Cargando cuentas...')
				const accountRepository = await getAccountRepository()
				const accountsData = await accountRepository.findAll()
				setAccounts(accountsData)
				console.log('✅ AccountsDataLoader: Cuentas cargadas exitosamente')
			} catch (err) {
				console.error('❌ AccountsDataLoader: Error cargando cuentas:', err)
				setError(err instanceof Error ? err.message : 'Error desconocido')
			} finally {
				setIsLoading(false)
			}
		}

		const timeoutId = setTimeout(() => {
			console.log('⏰ AccountsDataLoader: Timeout alcanzado, forzando fin de carga')
			setIsLoading(false)
		}, 5000)

		loadAccounts().finally(() => {
			clearTimeout(timeoutId)
		})

		return () => clearTimeout(timeoutId)
	}, [])

	return <>{children({ accounts, isLoading, error })}</>
} 