import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthRepository } from '@/app/repository/authRepository'

const mockFetch = vi.fn()
global.fetch = mockFetch

describe('AuthRepository', () => {
	let repo: AuthRepository

	beforeEach(() => {
		repo = new AuthRepository()
		mockFetch.mockClear()
	})

	describe('signUp', () => {
		it('posts registration data', async () => {
			mockFetch.mockResolvedValue({ ok: true })
			await repo.signUp('John', 'Doe', 'john@test.com', 'password123')
			expect(mockFetch).toHaveBeenCalledWith(
				'/api/backend/user',
				expect.objectContaining({
					method: 'POST',
					body: JSON.stringify({ name: 'John', last_name: 'Doe', email: 'john@test.com', password: 'password123' }),
				}),
			)
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
