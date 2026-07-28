import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MonthlyPlanRepository } from '@/app/repository/monthlyPlanRepository'

const mockFetch = vi.fn()
global.fetch = mockFetch

vi.mock('next-auth/react', () => ({ getSession: () => Promise.resolve({ accessToken: 'test-token' }) }))
vi.mock('next-auth', () => ({ getServerSession: () => Promise.resolve({ accessToken: 'test-token' }) }))
vi.mock('@/auth', () => ({ authOptions: {}, auth: () => Promise.resolve({ accessToken: 'test-token' }) }))

const okJson = (body: unknown) => ({ ok: true, json: () => Promise.resolve(body) })
const okNoBody = () => ({ ok: true, headers: { get: () => null }, json: () => Promise.resolve({}) })

describe('MonthlyPlanRepository', () => {
	let repo: MonthlyPlanRepository

	beforeEach(() => {
		repo = new MonthlyPlanRepository()
		mockFetch.mockClear()
	})

	describe('findAll', () => {
		it('fetches the plan items', async () => {
			const items = [{ id: '1', name: 'Alquiler', amount: 25000, type: 'bill' }]
			mockFetch.mockResolvedValue(okJson(items))

			const result = await repo.findAll()

			expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/monthly-plan'), expect.anything())
			expect(result).toEqual(items)
		})

		it('returns an empty array on error so the page still renders', async () => {
			mockFetch.mockRejectedValue(new Error('Network error'))

			expect(await repo.findAll()).toEqual([])
		})
	})

	describe('getSummary', () => {
		it('fetches the summary endpoint', async () => {
			const summary = { total_income: 97000, total_expenses: 27790, available: 69210 }
			mockFetch.mockResolvedValue(okJson(summary))

			const result = await repo.getSummary()

			expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('/monthly-plan/summary'), expect.anything())
			expect(result).toEqual(summary)
		})

		it('falls back to a zeroed summary on error', async () => {
			mockFetch.mockRejectedValue(new Error('Network error'))

			const result = await repo.getSummary()

			expect(result.total_income).toBe(0)
			expect(result.total_expenses).toBe(0)
			expect(result.available).toBe(0)
			expect(result.committed_percentage).toBe(0)
		})
	})

	describe('create', () => {
		it('posts the new item', async () => {
			mockFetch.mockResolvedValue(okNoBody())
			const payload = {
				name: 'Netflix',
				description: '',
				amount: 15,
				currency: 'USD' as const,
				type: 'bill' as const,
			}

			await repo.create(payload)

			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining('/monthly-plan'),
				expect.objectContaining({ method: 'POST', body: JSON.stringify(payload) }),
			)
		})

		it('rethrows so the form can show the error', async () => {
			mockFetch.mockRejectedValue(new Error('Validation failed'))

			await expect(
				repo.create({ name: '', description: '', amount: 0, currency: 'DOP', type: 'bill' }),
			).rejects.toThrow('Validation failed')
		})
	})

	describe('update', () => {
		it('puts to the item endpoint', async () => {
			mockFetch.mockResolvedValue(okNoBody())

			await repo.update('item-1', {
				name: 'Alquiler',
				description: '',
				amount: 26000,
				currency: 'DOP',
				type: 'bill',
			})

			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining('/monthly-plan/item-1'),
				expect.objectContaining({ method: 'PUT' }),
			)
		})
	})

	describe('setActive', () => {
		it('patches the active flag', async () => {
			mockFetch.mockResolvedValue(okNoBody())

			await repo.setActive('item-1', false)

			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining('/monthly-plan/item-1/active'),
				expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ is_active: false }) }),
			)
		})
	})

	describe('delete', () => {
		it('deletes the item', async () => {
			mockFetch.mockResolvedValue(okNoBody())

			await repo.delete('item-1')

			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining('/monthly-plan/item-1'),
				expect.objectContaining({ method: 'DELETE' }),
			)
		})

		it('rethrows on failure', async () => {
			mockFetch.mockRejectedValue(new Error('Not found'))

			await expect(repo.delete('nope')).rejects.toThrow('Not found')
		})
	})
})
