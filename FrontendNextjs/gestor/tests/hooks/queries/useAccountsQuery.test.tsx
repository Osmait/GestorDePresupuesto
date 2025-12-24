import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useGetAccounts, useGetAccount, ACCOUNT_KEYS } from '@/hooks/queries/useAccountsQuery'
import { vi } from 'vitest'
import React from 'react'

// Mock the repository
const mockFindAll = vi.fn()
const mockFindById = vi.fn()

vi.mock('@/lib/repositoryConfig', () => ({
    getAccountRepository: () => Promise.resolve({
        findAll: mockFindAll,
        findById: mockFindById,
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn()
    })
}))

// Wrapper for TanStack Query
function createWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
            },
        },
    })
    return ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
}

describe('useAccountsQuery', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('ACCOUNT_KEYS', () => {
        it('generates correct query keys', () => {
            expect(ACCOUNT_KEYS.all).toEqual(['accounts'])
            expect(ACCOUNT_KEYS.lists()).toEqual(['accounts', 'list'])
            expect(ACCOUNT_KEYS.detail('123')).toEqual(['accounts', 'detail', '123'])
        })
    })

    describe('useGetAccounts', () => {
        it('fetches and returns accounts reversed', async () => {
            const mockAccounts = [
                { id: '1', name: 'Account 1' },
                { id: '2', name: 'Account 2' }
            ]
            mockFindAll.mockResolvedValue(mockAccounts)

            const { result } = renderHook(() => useGetAccounts(), {
                wrapper: createWrapper()
            })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))

            // Accounts should be reversed (newest first)
            expect(result.current.data).toEqual([
                { id: '2', name: 'Account 2' },
                { id: '1', name: 'Account 1' }
            ])
        })

        it('handles empty array', async () => {
            mockFindAll.mockResolvedValue([])

            const { result } = renderHook(() => useGetAccounts(), {
                wrapper: createWrapper()
            })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))
            expect(result.current.data).toEqual([])
        })
    })

    describe('useGetAccount', () => {
        it('fetches single account by id', async () => {
            const mockAccount = { id: '123', name: 'Test Account' }
            mockFindById.mockResolvedValue(mockAccount)

            const { result } = renderHook(() => useGetAccount('123'), {
                wrapper: createWrapper()
            })

            await waitFor(() => expect(result.current.isSuccess).toBe(true))
            expect(result.current.data).toEqual(mockAccount)
            expect(mockFindById).toHaveBeenCalledWith('123')
        })

        it('is disabled when id is empty', () => {
            const { result } = renderHook(() => useGetAccount(''), {
                wrapper: createWrapper()
            })

            expect(result.current.fetchStatus).toBe('idle')
        })
    })
})
