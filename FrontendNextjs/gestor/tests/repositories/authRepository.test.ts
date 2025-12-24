import { AuthRepository } from '@/app/repository/authRepository'
import { vi, describe, it, expect, beforeEach } from 'vitest'

const mockFetch = vi.fn()
global.fetch = mockFetch

describe('AuthRepository', () => {
    let repo: AuthRepository

    beforeEach(() => {
        repo = new AuthRepository()
        mockFetch.mockClear()
    })

    describe('login', () => {
        it('posts credentials and returns user profile', async () => {
            mockFetch
                .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve('mock-token') })
                .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 'u1', name: 'John', email: 'john@test.com' }) })

            const result = await repo.login('john@test.com', 'password123')
            expect(result?.name).toBe('John')
        })
    })

    describe('signUp', () => {
        it('posts registration data', async () => {
            mockFetch.mockResolvedValue({ ok: true })
            await repo.signUp('John', 'Doe', 'john@test.com', 'password123')
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/user'),
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify({ name: 'John', last_name: 'Doe', email: 'john@test.com', password: 'password123' })
                })
            )
        })
    })

    describe('getProfile', () => {
        it('fetches user profile with token', async () => {
            const mockUser = { id: 'u1', name: 'John' }
            mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(mockUser) })
            const result = await repo.getProfile('valid-token')
            expect(result).toEqual(mockUser)
        })
    })

    describe('createDemoUser', () => {
        it('creates demo user and returns token', async () => {
            mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve('demo-token') })
            const result = await repo.createDemoUser()
            expect(result).toBe('demo-token')
        })

        it('throws on error', async () => {
            mockFetch.mockResolvedValue({ ok: false, text: () => Promise.resolve('Error') })
            await expect(repo.createDemoUser()).rejects.toThrow()
        })
    })
})
