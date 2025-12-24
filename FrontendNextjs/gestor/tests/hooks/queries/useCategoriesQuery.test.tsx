import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useGetCategories, CATEGORY_KEYS } from '@/hooks/queries/useCategoriesQuery'
import { vi } from 'vitest'
import React from 'react'

// Mock the repository
const mockFindAll = vi.fn()

vi.mock('@/lib/repositoryConfig', () => ({
    getCategoryRepository: () => Promise.resolve({
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

describe('useCategoriesQuery', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('CATEGORY_KEYS', () => {
        it('generates correct query keys', () => {
            expect(CATEGORY_KEYS.all).toEqual(['categories'])
            expect(CATEGORY_KEYS.lists()).toEqual(['categories', 'list'])
        })
    })

    describe('useGetCategories', () => {
        it('fetches and returns categories reversed', async () => {
            const mockCategories = [
                { id: '1', name: 'Food', icon: '🍔', color: '#f00' },
                { id: '2', name: 'Transport', icon: '🚗', color: '#0f0' }
            ]
            mockFindAll.mockResolvedValue(mockCategories)

            const { result } = renderHook(() => useGetCategories(), {
                wrapper: createWrapper()
            })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            expect(result.current.data).toEqual([
                { id: '2', name: 'Transport', icon: '🚗', color: '#0f0' },
                { id: '1', name: 'Food', icon: '🍔', color: '#f00' }
            ])
        })
    })
})
