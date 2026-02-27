import { CategoryRepository } from '@/app/repository/categoryRepository'
import { vi, describe, it, expect, beforeEach } from 'vitest'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock auth
vi.mock('next-auth/react', () => ({
    getSession: () => Promise.resolve({ accessToken: 'test-token' })
}))

vi.mock('next-auth', () => ({
    getServerSession: () => Promise.resolve({ accessToken: 'test-token' })
}))

vi.mock('@/auth', () => ({
    authOptions: {}
}))

describe('CategoryRepository', () => {
    let repo: CategoryRepository

    beforeEach(() => {
        repo = new CategoryRepository()
        mockFetch.mockClear()
    })

    describe('findAll', () => {
        it('fetches all categories', async () => {
            const mockCategories = [
                { id: '1', name: 'Food', icon: '🍔', color: '#f00' },
                { id: '2', name: 'Transport', icon: '🚗', color: '#0f0' }
            ]
            mockFetch.mockResolvedValue({
                ok: true,
                json: () => Promise.resolve(mockCategories)
            })

            const result = await repo.findAll()

            expect(result).toEqual(mockCategories)
        })

        it('returns empty array on error', async () => {
            mockFetch.mockRejectedValue(new Error('Network error'))

            const result = await repo.findAll()

            expect(result).toEqual([])
        })
    })

    describe('create', () => {
        it('posts new category data', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                headers: { get: () => null },
                json: () => Promise.resolve({})
            })

            await repo.create('Food', '🍔', '#FF0000')

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/category'),
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify({ name: 'Food', icon: '🍔', color: '#FF0000' })
                })
            )
        })
    })

    describe('update', () => {
        it('puts updated category data', async () => {
            mockFetch.mockResolvedValue({
                ok: true,
                headers: { get: () => null },
                json: () => Promise.resolve({})
            })

            await repo.update('1', 'Updated Food', '🍕', '#00FF00')

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/category/1'),
                expect.objectContaining({
                    method: 'PUT',
                    body: JSON.stringify({ name: 'Updated Food', icon: '🍕', color: '#00FF00' })
                })
            )
        })
    })

    describe('delete', () => {
        it('sends delete request', async () => {
            mockFetch.mockResolvedValue({ ok: true })

            await repo.delete('1')

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/category/1'),
                expect.objectContaining({ method: 'DELETE' })
            )
        })
    })
})
