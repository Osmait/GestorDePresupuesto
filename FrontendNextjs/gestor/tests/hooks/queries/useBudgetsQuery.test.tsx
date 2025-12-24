import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useGetBudgets, BUDGET_KEYS } from '@/hooks/queries/useBudgetsQuery'
import { vi } from 'vitest'
import React from 'react'

// Mock the repository
const mockFindAll = vi.fn()

vi.mock('@/lib/repositoryConfig', () => ({
    getBudgetRepository: () => Promise.resolve({
        findAll: mockFindAll,
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn()
    })
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
                { id: '2', category_id: 'c2', amount: 1000 }
            ]
            mockFindAll.mockResolvedValue(mockBudgets)

            const { result } = renderHook(() => useGetBudgets(), {
                wrapper: createWrapper()
            })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(result.current.data).toEqual([
                { id: '2', category_id: 'c2', amount: 1000 },
                { id: '1', category_id: 'c1', amount: 500 }
            ])
        })

        it('handles empty array', async () => {
            mockFindAll.mockResolvedValue([])

            const { result } = renderHook(() => useGetBudgets(), {
                wrapper: createWrapper()
            })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))
            expect(result.current.data).toEqual([])
        })
    })
})
