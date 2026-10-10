import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import React from 'react'
import { vi } from 'vitest'
import { BUDGET_KEYS, useBudgetTransactionCounts, useGetBudgets } from '@/hooks/queries/useBudgetsQuery'

// Mock the repository
const mockFindAll = vi.fn()
const mockCount = vi.fn()

vi.mock('@/lib/repositoryConfig', () => ({
	getBudgetRepository: () =>
		Promise.resolve({
			findAll: mockFindAll,
			create: vi.fn(),
			update: vi.fn(),
			delete: vi.fn(),
		}),
	getTransactionRepository: () => Promise.resolve({ count: mockCount }),
}))

// Wrapper for TanStack Query
function createWrapper() {
	const queryClient = new QueryClient({
		defaultOptions: { queries: { retry: false } },
	})
	return ({ children }: { children: React.ReactNode }) => (
		<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
	)
}

describe('useBudgetsQuery', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	describe('BUDGET_KEYS', () => {
		it('generates correct query keys', () => {
			expect(BUDGET_KEYS.all).toEqual(['budgets'])
			expect(BUDGET_KEYS.lists()).toEqual(['budgets', 'list'])
		})
	})

	describe('useGetBudgets', () => {
		it('fetches and returns budgets reversed', async () => {
			const mockBudgets = [
				{ id: '1', category_id: 'c1', amount: 500 },
				{ id: '2', category_id: 'c2', amount: 1000 },
			]
			mockFindAll.mockResolvedValue(mockBudgets)

			const { result } = renderHook(() => useGetBudgets(), {
				wrapper: createWrapper(),
			})

			await waitFor(() => expect(result.current.isSuccess).toBe(true))

			expect(result.current.data).toEqual([
				{ id: '2', category_id: 'c2', amount: 1000 },
				{ id: '1', category_id: 'c1', amount: 500 },
			])
		})

		it('handles empty array', async () => {
			mockFindAll.mockResolvedValue([])

			const { result } = renderHook(() => useGetBudgets(), {
				wrapper: createWrapper(),
			})

			await waitFor(() => expect(result.current.isSuccess).toBe(true))
			expect(result.current.data).toEqual([])
		})
	})

	describe('useBudgetTransactionCounts', () => {
		it('asks for one expense count per budget instead of every transaction', async () => {
			mockCount.mockImplementation(async ({ budget_id }: { budget_id: string }) => (budget_id === 'b1' ? 3 : 7))

			const { result } = renderHook(() => useBudgetTransactionCounts(['b2', 'b1']), { wrapper: createWrapper() })

			await waitFor(() => expect(result.current.isSuccess).toBe(true))
			expect(result.current.data).toEqual({ b1: 3, b2: 7 })
			expect(mockCount).toHaveBeenCalledTimes(2)
			expect(mockCount).toHaveBeenCalledWith({ budget_id: 'b1', type: 'bill' })
		})

		it('does nothing without budgets and lives under the budgets root key', () => {
			const { result } = renderHook(() => useBudgetTransactionCounts([]), { wrapper: createWrapper() })
			expect(result.current.fetchStatus).toBe('idle')
			expect(mockCount).not.toHaveBeenCalled()
			expect(BUDGET_KEYS.transactionCounts(['b1'])[0]).toBe('budgets')
		})
	})
})
