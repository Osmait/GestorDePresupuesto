import { AnalyticsRepository } from '@/app/repository/analyticsRepository'
import { vi, describe, it, expect, beforeEach } from 'vitest'

const mockFetch = vi.fn()
global.fetch = mockFetch

vi.mock('next-auth/react', () => ({ getSession: () => Promise.resolve({ accessToken: 'test-token' }) }))
vi.mock('next-auth', () => ({ getServerSession: () => Promise.resolve({ accessToken: 'test-token' }) }))
vi.mock('@/auth', () => ({ authOptions: {} }))

describe('AnalyticsRepository', () => {
    let repo: AnalyticsRepository

    beforeEach(() => {
        repo = new AnalyticsRepository()
        mockFetch.mockClear()
    })

    describe('getCategoryExpenses', () => {
        it('fetches category expenses', async () => {
            const mockData = [{ id: 'c1', label: 'Food', value: 500 }]
            mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(mockData) })
            const result = await repo.getCategoryExpenses()
            expect(result).toEqual(mockData)
        })

        it('returns empty array on error', async () => {
            mockFetch.mockRejectedValue(new Error('Network'))
            const result = await repo.getCategoryExpenses()
            expect(result).toEqual([])
        })
    })

    describe('getMonthlySummary', () => {
        it('fetches monthly summary', async () => {
            const mockData = [{ month: 'Jan', Ingresos: 1000, Gastos: -500 }]
            mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(mockData) })
            const result = await repo.getMonthlySummary()
            expect(result).toEqual(mockData)
        })

        it('returns empty array on error', async () => {
            mockFetch.mockRejectedValue(new Error('Network'))
            const result = await repo.getMonthlySummary()
            expect(result).toEqual([])
        })
    })
})
