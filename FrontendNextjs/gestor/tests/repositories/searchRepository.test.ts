import { SearchRepository } from '@/app/repository/searchRepository'
import { vi, describe, it, expect, beforeEach } from 'vitest'

const mockFetch = vi.fn()
global.fetch = mockFetch

vi.mock('next-auth/react', () => ({ getSession: () => Promise.resolve({ accessToken: 'test-token' }) }))
vi.mock('next-auth', () => ({ getServerSession: () => Promise.resolve({ accessToken: 'test-token' }) }))
vi.mock('@/auth', () => ({ authOptions: {} }))

describe('SearchRepository', () => {
    let repo: SearchRepository

    beforeEach(() => {
        repo = new SearchRepository()
        mockFetch.mockClear()
    })

    describe('search', () => {
        it('returns empty result for empty query', async () => {
            const result = await repo.search('')
            expect(result).toEqual({ transactions: [], categories: [], accounts: [], budgets: [] })
        })

        it('fetches search results', async () => {
            const mockData = { transactions: [{ id: 't1' }], categories: [], accounts: [], budgets: [] }
            mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(mockData) })
            const result = await repo.search('test')
            expect(result.transactions).toHaveLength(1)
        })

        it('returns empty result on error', async () => {
            mockFetch.mockRejectedValue(new Error('Network'))
            const result = await repo.search('test')
            expect(result).toEqual({ transactions: [], categories: [], accounts: [], budgets: [] })
        })
    })
})
