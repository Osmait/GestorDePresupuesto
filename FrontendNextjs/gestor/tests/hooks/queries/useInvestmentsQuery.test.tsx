import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useGetInvestments, INVESTMENT_KEYS } from '@/hooks/queries/useInvestmentsQuery'
import { vi } from 'vitest'
import React from 'react'

// Mock the repository
const mockFindAll = vi.fn()

vi.mock('@/lib/repositoryConfig', () => ({
    getInvestmentRepository: () => Promise.resolve({
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

describe('useInvestmentsQuery', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('INVESTMENT_KEYS', () => {
        it('generates correct query keys', () => {
            expect(INVESTMENT_KEYS.all).toEqual(['investments'])
            expect(INVESTMENT_KEYS.lists()).toEqual(['investments', 'list'])
            expect(INVESTMENT_KEYS.detail('123')).toEqual(['investments', 'detail', '123'])
        })
    })

    describe('useGetInvestments', () => {
        it('fetches investments', async () => {
            const mockInvestments = [
                { id: 'i1', symbol: 'AAPL', type: 'STOCK', purchase_price: 150, current_price: 175, quantity: 10 },
                { id: 'i2', symbol: 'BTC', type: 'CRYPTO', purchase_price: 30000, current_price: 42000, quantity: 0.5 }
            ]
            mockFindAll.mockResolvedValue(mockInvestments)

            const { result } = renderHook(() => useGetInvestments(), {
                wrapper: createWrapper()
            })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(result.current.data).toEqual(mockInvestments)
        })

        it('filters by type', async () => {
            const mockInvestments = [
                { id: 'i1', symbol: 'AAPL', type: 'STOCK' }
            ]
            mockFindAll.mockResolvedValue(mockInvestments)

            const { result } = renderHook(() => useGetInvestments({ type: 'STOCK' }), {
                wrapper: createWrapper()
            })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))
            expect(mockFindAll).toHaveBeenCalledWith({ type: 'STOCK' })
        })
    })
})
