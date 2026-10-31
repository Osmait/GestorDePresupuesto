import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AnalyticsRepository } from '@/app/repository/analyticsRepository'

const mockFetch = vi.fn()
global.fetch = mockFetch

vi.mock('next-auth/react', () => ({ getSession: () => Promise.resolve({ accessToken: 'test-token' }) }))
vi.mock('next-auth', () => ({ getServerSession: () => Promise.resolve({ accessToken: 'test-token' }) }))
vi.mock('@/auth', () => ({ authOptions: {} }))

describe('AnalyticsRepository', () => {
	let repo: AnalyticsRepository

	beforeEach(() => {
		repo = new AnalyticsRepository()
		mockFetch.mockClear()
	})

	describe('getCategoryExpenses', () => {
		it('fetches category expenses', async () => {
			const mockData = [{ id: 'c1', label: 'Food', value: 500, color: '#EF4444' }]
			mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(mockData) })
			const result = await repo.getCategoryExpenses()
			expect(result).toEqual(mockData)
		})

		it('maps CSS color names (seeded sign-up categories) to the palette', async () => {
			mockFetch.mockResolvedValue({
				ok: true,
				json: () => Promise.resolve([{ id: 'c1', label: 'Transporte', value: 500, color: 'blue' }]),
			})
			const [expense] = await repo.getCategoryExpenses()
			expect(expense.color).toBe('#3B82F6')
		})

		it('returns empty array on error', async () => {
			mockFetch.mockRejectedValue(new Error('Network'))
			const result = await repo.getCategoryExpenses()
			expect(result).toEqual([])
		})
	})

	describe('getMonthlySummary', () => {
		it('fetches monthly summary', async () => {
			const mockData = [{ month: 'Jan', Ingresos: 1000, Gastos: -500 }]
			mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(mockData) })
			const result = await repo.getMonthlySummary()
			expect(result).toEqual(mockData)
		})

		it('returns empty array on error', async () => {
			mockFetch.mockRejectedValue(new Error('Network'))
			const result = await repo.getMonthlySummary()
			expect(result).toEqual([])
		})
	})
	describe('getDashboardSummary', () => {
		it('sends the filters as query params', async () => {
			const mockData = { total_income: 1000, total_expenses: 400, category_expenses: [], monthly_summary: [] }
			mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(mockData) })

			const result = await repo.getDashboardSummary({
				date_from: '2026-10-01',
				date_to: '2026-10-11',
				account_id: 'acc-1',
				category_id: 'all',
				type: 'bill',
			})

			expect(result).toEqual(mockData)
			const url = new URL(String(mockFetch.mock.calls[0][0]), 'http://localhost')
			expect(url.pathname).toMatch(/\/analytics\/dashboard-summary$/)
			expect(Object.fromEntries(url.searchParams)).toEqual({
				date_from: '2026-10-01',
				date_to: '2026-10-11',
				account_id: 'acc-1',
				type: 'bill',
			})
		})

		it('calls the endpoint without a query string when there are no filters', async () => {
			mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) })
			await repo.getDashboardSummary()
			expect(String(mockFetch.mock.calls[0][0])).toMatch(/\/analytics\/dashboard-summary$/)
		})

		it('lets network errors reach the caller instead of returning zeros', async () => {
			mockFetch.mockRejectedValue(new Error('Network'))
			await expect(repo.getDashboardSummary({ date_from: '2026-10-01' })).rejects.toThrow('Network')
		})

		it('rejects on an HTTP error', async () => {
			mockFetch.mockResolvedValue({
				ok: false,
				status: 500,
				statusText: 'Internal Server Error',
				headers: new Headers(),
				json: () => Promise.resolve({ error: 'boom' }),
				text: () => Promise.resolve('{"error":"boom"}'),
			})
			await expect(repo.getDashboardSummary()).rejects.toBeDefined()
		})
	})
})
