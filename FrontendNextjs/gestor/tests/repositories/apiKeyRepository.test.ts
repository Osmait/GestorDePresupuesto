import { beforeEach, describe, expect, it, vi } from 'vitest'
import { APIKeyRepository } from '@/app/repository/apiKeyRepository'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

vi.mock('next-auth/react', () => ({
	getSession: () => Promise.resolve({ accessToken: 'test-token' }),
}))

vi.mock('next-auth', () => ({
	getServerSession: () => Promise.resolve({ accessToken: 'test-token' }),
}))

vi.mock('@/auth', () => ({
	authOptions: {},
}))

describe('APIKeyRepository', () => {
	let repo: APIKeyRepository

	beforeEach(() => {
		repo = new APIKeyRepository()
		mockFetch.mockClear()
	})

	describe('findAll', () => {
		it('fetches all API keys', async () => {
			const mockKeys = [
				{
					id: 'key-1',
					user_id: 'user-1',
					name: 'Claude Desktop',
					key_prefix: 'sk-abc123',
					last_used_at: null,
					expires_at: null,
					created_at: '2024-01-15T10:00:00Z',
					is_active: true,
				},
				{
					id: 'key-2',
					user_id: 'user-1',
					name: 'My Integration',
					key_prefix: 'sk-xyz789',
					last_used_at: '2024-02-01T12:00:00Z',
					expires_at: null,
					created_at: '2024-01-20T09:00:00Z',
					is_active: false,
				},
			]
			mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(mockKeys) })

			const result = await repo.findAll()

			expect(result).toEqual(mockKeys)
			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining('/api-keys'),
				expect.objectContaining({ headers: expect.any(Object) }),
			)
		})

		it('returns empty array on error', async () => {
			mockFetch.mockRejectedValue(new Error('Network error'))

			const result = await repo.findAll()

			expect(result).toEqual([])
		})
	})

	describe('create', () => {
		it('posts new key with name and returns created key response', async () => {
			const mockResponse = {
				id: 'key-1',
				name: 'Claude Desktop',
				token: 'sk-full-token-abc123xyz',
				key_prefix: 'sk-abc123',
				created_at: '2024-01-15T10:00:00Z',
			}
			mockFetch.mockResolvedValue({
				ok: true,
				headers: { get: (header: string) => (header === 'content-type' ? 'application/json' : null) },
				json: () => Promise.resolve(mockResponse),
			})

			const result = await repo.create('Claude Desktop')

			expect(result).toEqual(mockResponse)
			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining('/api-keys'),
				expect.objectContaining({
					method: 'POST',
					body: JSON.stringify({ name: 'Claude Desktop' }),
				}),
			)
		})
	})

	describe('revoke', () => {
		it('sends delete request for the given key id', async () => {
			mockFetch.mockResolvedValue({ ok: true })

			await repo.revoke('key-1')

			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining('/api-keys/key-1'),
				expect.objectContaining({ method: 'DELETE' }),
			)
		})
	})
})
