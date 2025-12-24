import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useGetTransactions, useGetAllTransactions, TRANSACTION_KEYS } from '@/hooks/queries/useTransactionsQuery'
import { vi } from 'vitest'
import React from 'react'

// Mock the repository
const mockFindAll = vi.fn()
const mockFindAllSimple = vi.fn()

vi.mock('@/lib/repositoryConfig', () => ({
    getTransactionRepository: () => Promise.resolve({
        findAll: mockFindAll,
        findAllSimple: mockFindAllSimple,
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

describe('useTransactionsQuery', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('TRANSACTION_KEYS', () => {
        it('generates correct query keys', () => {
            expect(TRANSACTION_KEYS.all).toEqual(['transactions'])
            expect(TRANSACTION_KEYS.lists()).toEqual(['transactions', 'list'])
            expect(TRANSACTION_KEYS.list({ page: 1 })).toEqual(['transactions', 'list', { page: 1 }])
            expect(TRANSACTION_KEYS.simple()).toEqual(['transactions', 'simple'])
        })
    })

    describe('useGetTransactions', () => {
        it('fetches transactions with pagination', async () => {
            const mockResponse = {
                data: [
                    { id: 't1', name: 'Transaction 1', amount: 100 },
                    { id: 't2', name: 'Transaction 2', amount: 200 }
                ],
                pagination: { page: 1, pageSize: 10, total: 2 }
            }
            mockFindAll.mockResolvedValue(mockResponse)

            const { result } = renderHook(() => useGetTransactions({ page: 1 }), {
                wrapper: createWrapper()
            })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(result.current.data?.transactions).toHaveLength(2)
            expect(result.current.data?.pagination).toEqual({ page: 1, pageSize: 10, total: 2 })
        })
    })

    describe('useGetAllTransactions', () => {
        it('fetches all transactions (simple)', async () => {
            const mockTransactions = [
                { id: 't1', name: 'Transaction 1', amount: 100 },
                { id: 't2', name: 'Transaction 2', amount: 200 }
            ]
            mockFindAllSimple.mockResolvedValue(mockTransactions)

            const { result } = renderHook(() => useGetAllTransactions(), {
                wrapper: createWrapper()
            })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))
            expect(result.current.data).toEqual(mockTransactions)
        })
    })
})
