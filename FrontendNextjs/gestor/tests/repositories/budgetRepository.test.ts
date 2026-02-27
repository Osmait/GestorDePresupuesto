import { BudgetRepository } from '@/app/repository/budgetRepository'
import { vi, describe, it, expect, beforeEach } from 'vitest'

const mockFetch = vi.fn()
global.fetch = mockFetch

vi.mock('next-auth/react', () => ({ getSession: () => Promise.resolve({ accessToken: 'test-token' }) }))
vi.mock('next-auth', () => ({ getServerSession: () => Promise.resolve({ accessToken: 'test-token' }) }))
vi.mock('@/auth', () => ({ authOptions: {} }))

describe('BudgetRepository', () => {
    let repo: BudgetRepository

    beforeEach(() => {
        repo = new BudgetRepository()
        mockFetch.mockClear()
    })

    describe('findAll', () => {
        it('fetches all budgets', async () => {
            const mockBudgets = [{ id: '1', category_id: 'c1', amount: 500 }]
            mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(mockBudgets) })
            const result = await repo.findAll()
            expect(result).toEqual(mockBudgets)
        })

        it('returns empty array on error', async () => {
            mockFetch.mockRejectedValue(new Error('Network error'))
            const result = await repo.findAll()
            expect(result).toEqual([])
        })
    })

    describe('create', () => {
        it('posts new budget', async () => {
            mockFetch.mockResolvedValue({ ok: true, headers: { get: () => null }, json: () => Promise.resolve({}) })
            await repo.create('cat1', 1000)
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/budget'),
                expect.objectContaining({ method: 'POST', body: JSON.stringify({ category_id: 'cat1', amount: 1000 }) })
            )
        })
    })

    describe('update', () => {
        it('puts updated budget', async () => {
            mockFetch.mockResolvedValue({ ok: true, headers: { get: () => null }, json: () => Promise.resolve({}) })
            await repo.update('1', 'cat1', 1500)
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/budget/1'),
                expect.objectContaining({ method: 'PUT' })
            )
        })
    })

    describe('delete', () => {
        it('sends delete request', async () => {
            mockFetch.mockResolvedValue({ ok: true })
            await repo.delete('1')
            expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/budget/1'), expect.objectContaining({ method: 'DELETE' }))
        })
    })
})
