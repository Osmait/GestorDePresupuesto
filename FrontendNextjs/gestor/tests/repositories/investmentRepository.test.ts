import { InvestmentRepository } from '@/app/repository/investmentRepository'
import { vi, describe, it, expect, beforeEach } from 'vitest'

const mockFetch = vi.fn()
global.fetch = mockFetch

vi.mock('next-auth/react', () => ({ getSession: () => Promise.resolve({ accessToken: 'test-token' }) }))
vi.mock('next-auth', () => ({ getServerSession: () => Promise.resolve({ accessToken: 'test-token' }) }))
vi.mock('@/auth', () => ({ authOptions: {} }))

describe('InvestmentRepository', () => {
    let repo: InvestmentRepository

    beforeEach(() => {
        repo = new InvestmentRepository()
        mockFetch.mockClear()
    })

    describe('findAll', () => {
        it('fetches all investments', async () => {
            const mockInvestments = [{ id: '1', symbol: 'AAPL', quantity: 10 }]
            mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(mockInvestments) })
            const result = await repo.findAll()
            expect(result).toEqual(mockInvestments)
        })

        it('returns empty array on error', async () => {
            mockFetch.mockRejectedValue(new Error('Network error'))
            const result = await repo.findAll()
            expect(result).toEqual([])
        })
    })

    describe('create', () => {
        it('posts new investment', async () => {
            mockFetch.mockResolvedValue({ ok: true, headers: { get: () => null }, json: () => Promise.resolve({}) })
            await repo.create({ symbol: 'AAPL', quantity: 10, purchase_price: 150, type: 'STOCK' } as any)
            expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/investments'), expect.objectContaining({ method: 'POST' }))
        })
    })

    describe('update', () => {
        it('puts updated investment', async () => {
            mockFetch.mockResolvedValue({ ok: true, headers: { get: () => null }, json: () => Promise.resolve({}) })
            await repo.update({ id: '1', current_price: 175 } as any)
            expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/investments/1'), expect.objectContaining({ method: 'PUT' }))
        })
    })

    describe('delete', () => {
        it('sends delete request', async () => {
            mockFetch.mockResolvedValue({ ok: true })
            await repo.delete('1')
            expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/investments/1'), expect.objectContaining({ method: 'DELETE' }))
        })
    })

    describe('getQuote', () => {
        it('fetches stock quote', async () => {
            const mockQuote = { regular_market_price: 175.50, symbol: 'AAPL' }
            mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(mockQuote) })
            const result = await repo.getQuote('AAPL')
            expect(result).toEqual(mockQuote)
        })
    })
})
