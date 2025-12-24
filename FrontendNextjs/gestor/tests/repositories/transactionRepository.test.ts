import { TransactionRepository } from '@/app/repository/transactionRepository'
import { TypeTransaction } from '@/types/transaction'
import { vi, describe, it, expect, beforeEach } from 'vitest'

const mockFetch = vi.fn()
global.fetch = mockFetch

vi.mock('next-auth/react', () => ({ getSession: () => Promise.resolve({ accessToken: 'test-token' }) }))
vi.mock('next-auth', () => ({ getServerSession: () => Promise.resolve({ accessToken: 'test-token' }) }))
vi.mock('@/auth', () => ({ authOptions: {} }))

describe('TransactionRepository', () => {
    let repo: TransactionRepository

    beforeEach(() => {
        repo = new TransactionRepository()
        mockFetch.mockClear()
    })

    describe('findAll', () => {
        it('fetches paginated transactions', async () => {
            const mockResponse = { data: [{ id: 't1', name: 'Test' }], pagination: { current_page: 1, total_pages: 1 } }
            mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(mockResponse) })
            const result = await repo.findAll({ page: 1 })
            expect(result.data).toHaveLength(1)
        })

        it('returns empty response on error', async () => {
            mockFetch.mockRejectedValue(new Error('Network'))
            const result = await repo.findAll()
            expect(result.data).toEqual([])
        })
    })

    describe('findAllSimple', () => {
        it('returns transaction data array', async () => {
            const mockResponse = { data: [{ id: 't1' }, { id: 't2' }], pagination: {} }
            mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(mockResponse) })
            const result = await repo.findAllSimple()
            expect(result).toHaveLength(2)
        })
    })

    describe('create', () => {
        it('posts new transaction', async () => {
            mockFetch.mockResolvedValue({ ok: true, headers: { get: () => null }, json: () => Promise.resolve({}) })
            await repo.create('Test', 'Desc', 100, TypeTransaction.BILL, 'acc1', 'cat1')
            expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/transaction'), expect.objectContaining({ method: 'POST' }))
        })
    })

    describe('update', () => {
        it('puts updated transaction', async () => {
            mockFetch.mockResolvedValue({ ok: true, headers: { get: () => null }, json: () => Promise.resolve({}) })
            await repo.update('1', 'Updated', 'Desc', 200, TypeTransaction.INCOME, 'acc1', 'cat1')
            expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/transaction/1'), expect.objectContaining({ method: 'PUT' }))
        })
    })

    describe('delete', () => {
        it('sends delete request', async () => {
            mockFetch.mockResolvedValue({ ok: true })
            await repo.delete('1')
            expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/transaction/1'), expect.objectContaining({ method: 'DELETE' }))
        })
    })
})
