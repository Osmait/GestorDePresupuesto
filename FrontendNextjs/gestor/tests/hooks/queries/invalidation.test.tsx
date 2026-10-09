import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import React from 'react'
import { vi } from 'vitest'
import { useCreateAccountMutation, useDeleteAccountMutation } from '@/hooks/queries/useAccountsQuery'
import { useCreateBudgetMutation } from '@/hooks/queries/useBudgetsQuery'
import {
	useCreateTransactionMutation,
	useDeleteTransactionMutation,
	useUpdateTransactionMutation,
} from '@/hooks/queries/useTransactionsQuery'
import { TypeTransaction } from '@/types/transaction'

const repo = {
	create: vi.fn().mockResolvedValue(undefined),
	update: vi.fn().mockResolvedValue(undefined),
	delete: vi.fn().mockResolvedValue(undefined),
}

vi.mock('@/lib/repositoryConfig', () => ({
	getTransactionRepository: () => Promise.resolve(repo),
	getAccountRepository: () => Promise.resolve(repo),
	getBudgetRepository: () => Promise.resolve(repo),
}))

const FINANCIAL_KEYS = [
	['accounts', 'list'],
	['accounts', 'detail', 'a1'],
	['transactions', 'list', { page: 1 }],
	['transactions', 'simple'],
	['budgets', 'list'],
	['categories', 'list'],
	['analytics', 'dashboardSummary', {}],
	['search', 'rent'],
] as const
const UNRELATED_KEY = ['investments', 'list', {}] as const

function setup() {
	const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	for (const key of [...FINANCIAL_KEYS, UNRELATED_KEY]) {
		queryClient.setQueryData(key, { seeded: true })
	}
	const wrapper = ({ children }: { children: React.ReactNode }) => (
		<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
	)
	const isInvalidated = (key: readonly unknown[]) => queryClient.getQueryState(key)?.isInvalidated
	return { wrapper, isInvalidated }
}

const transactionInput = {
	name: 'Rent',
	description: '',
	amount: 1500.5,
	type: TypeTransaction.BILL,
	accountId: 'a1',
	categoryId: 'c1',
}

describe('mutation cache invalidation', () => {
	it.each([
		['create', () => useCreateTransactionMutation(), transactionInput],
		['update', () => useUpdateTransactionMutation(), { ...transactionInput, id: 't1' }],
		['delete', () => useDeleteTransactionMutation(), 't1'],
	] as const)('transaction %s invalidates balances, lists, budgets and analytics', async (_name, useHook, input) => {
		const { wrapper, isInvalidated } = setup()
		const { result } = renderHook(useHook as () => { mutateAsync: (_v: any) => Promise<unknown> }, { wrapper })

		await act(async () => {
			await result.current.mutateAsync(input)
		})

		for (const key of FINANCIAL_KEYS) {
			expect(isInvalidated(key), JSON.stringify(key)).toBe(true)
		}
		expect(isInvalidated(UNRELATED_KEY)).toBe(false)
	})

	it('account create/delete invalidates accounts (list + detail) and dependent data', async () => {
		const { wrapper, isInvalidated } = setup()
		const create = renderHook(() => useCreateAccountMutation(), { wrapper })
		await act(async () => {
			await create.result.current.mutateAsync({ name: 'Main', bank: 'BHD', initial_balance: 100 })
		})
		expect(isInvalidated(['accounts', 'list'])).toBe(true)
		expect(isInvalidated(['accounts', 'detail', 'a1'])).toBe(true)
		expect(isInvalidated(['analytics', 'dashboardSummary', {}])).toBe(true)

		const { wrapper: wrapper2, isInvalidated: isInvalidated2 } = setup()
		const remove = renderHook(() => useDeleteAccountMutation(), { wrapper: wrapper2 })
		await act(async () => {
			await remove.result.current.mutateAsync('a1')
		})
		expect(isInvalidated2(['transactions', 'list', { page: 1 }])).toBe(true)
	})

	it('budget create invalidates budgets and analytics but not transactions', async () => {
		const { wrapper, isInvalidated } = setup()
		const { result } = renderHook(() => useCreateBudgetMutation(), { wrapper })
		await act(async () => {
			await result.current.mutateAsync({ categoryId: 'c1', amount: 500 })
		})
		expect(isInvalidated(['budgets', 'list'])).toBe(true)
		expect(isInvalidated(['analytics', 'dashboardSummary', {}])).toBe(true)
		expect(isInvalidated(['transactions', 'list', { page: 1 }])).toBe(false)
	})
})
