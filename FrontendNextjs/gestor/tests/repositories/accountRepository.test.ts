import { AccountRepository } from '@/app/repository/accountRepository'
import { vi, describe, it, expect, beforeEach } from 'vitest'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock next-auth
vi.mock('next-auth/react', () => ({
    getSession: () => Promise.resolve({ accessToken: 'test-token' })
}))

vi.mock('next-auth', () => ({
    getServerSession: () => Promise.resolve({ accessToken: 'test-token' })
}))

vi.mock('@/auth', () => ({
    authOptions: {}
}))

describe('AccountRepository', () => {
    let repo: AccountRepository

    beforeEach(() => {
        repo = new AccountRepository()
        mockFetch.mockClear()
    })

    describe('findAll', () => {
        it('fetches and normalizes accounts', async () => {
            const mockResponse = [
                { account_info: { id: '1', name: 'Checking', bank: 'Bank A' }, current_balance: 1000 },
                { account_info: { id: '2', name: 'Savings', bank: 'Bank B' }, current_balance: 5000 }
            ]
            mockFetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(mockResponse)
            })

            const result = await repo.findAll()

            expect(result).toEqual([
                { id: '1', name: 'Checking', bank: 'Bank A', current_balance: 1000 },
                { id: '2', name: 'Savings', bank: 'Bank B', current_balance: 5000 }
            ])
        })

        it('returns empty array on error', async () => {
            mockFetch.mockRejectedValue(new Error('Network error'))

            const result = await repo.findAll()

            expect(result).toEqual([])
        })
    })

    describe('create', () => {
        it('posts new account data', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                headers: { get: () => null },
                json: () => Promise.resolve({})
            })

            await repo.create('New Account', 'New Bank', 500)

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/account'),
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify({ name: 'New Account', bank: 'New Bank', initial_balance: 500 })
                })
            )
        })
    })

    describe('findById', () => {
        it('fetches and normalizes single account', async () => {
            const mockResponse = { account_info: { id: '1', name: 'Checking', bank: 'Bank A' }, current_balance: 1000 }
            mockFetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(mockResponse)
            })

            const result = await repo.findById('1')

            expect(result).toEqual({ id: '1', name: 'Checking', bank: 'Bank A', current_balance: 1000 })
        })

        it('returns null on error', async () => {
            mockFetch.mockRejectedValue(new Error('Not found'))

            const result = await repo.findById('invalid')

            expect(result).toBeNull()
        })
    })
})
