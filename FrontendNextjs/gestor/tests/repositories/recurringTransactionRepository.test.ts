import { RecurringTransactionRepository } from '@/app/repository/recurringTransactionRepository'
import { vi, describe, it, expect, beforeEach } from 'vitest'

const mockFetch = vi.fn()
global.fetch = mockFetch

vi.mock('next-auth/react', () => ({ getSession: () => Promise.resolve({ accessToken: 'test-token' }) }))
vi.mock('next-auth', () => ({ getServerSession: () => Promise.resolve({ accessToken: 'test-token' }) }))
vi.mock('@/auth', () => ({ authOptions: {} }))

describe('RecurringTransactionRepository', () => {
    let repo: RecurringTransactionRepository

    beforeEach(() => {
        repo = new RecurringTransactionRepository()
        mockFetch.mockClear()
    })

    describe('findAll', () => {
        it('fetches all recurring transactions', async () => {
            const mockData = [{ id: 'rt1', name: 'Netflix', amount: 15.99 }]
            mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(mockData) })
            const result = await repo.findAll()
            expect(result).toEqual(mockData)
        })

        it('returns empty array on error', async () => {
            mockFetch.mockRejectedValue(new Error('Network'))
            const result = await repo.findAll()
            expect(result).toEqual([])
        })
    })

    describe('create', () => {
        it('posts new recurring transaction', async () => {
            mockFetch.mockResolvedValue({ ok: true, headers: { get: () => null }, json: () => Promise.resolve({}) })
            await repo.create({ name: 'Netflix', amount: 15.99, day_of_month: 15, type: 'expense' } as any)
            expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/recurring-transactions'), expect.objectContaining({ method: 'POST' }))
        })
    })

    describe('update', () => {
        it('puts updated recurring transaction', async () => {
            mockFetch.mockResolvedValue({ ok: true, headers: { get: () => null }, json: () => Promise.resolve({}) })
            await repo.update('1', { name: 'Updated', amount: 20 } as any)
            expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/recurring-transactions/1'), expect.objectContaining({ method: 'PUT' }))
        })
    })

    describe('delete', () => {
        it('sends delete request', async () => {
            mockFetch.mockResolvedValue({ ok: true })
            await repo.delete('1')
            expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/recurring-transactions/1'), expect.objectContaining({ method: 'DELETE' }))
        })
    })

    describe('process', () => {
        it('posts to process endpoint', async () => {
            mockFetch.mockResolvedValue({ ok: true, headers: { get: () => null }, json: () => Promise.resolve({}) })
            await repo.process()
            expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/recurring-transactions/process'), expect.objectContaining({ method: 'POST' }))
        })
    })
})
