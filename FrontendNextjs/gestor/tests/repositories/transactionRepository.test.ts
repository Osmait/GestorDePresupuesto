import { beforeEach, describe, expect, it, vi } from 'vitest'
import { TransactionRepository } from '@/app/repository/transactionRepository'
import { TypeTransaction } from '@/types/transaction'

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

		it('fetches all pages with backend max limit', async () => {
			const page1 = {
				data: [{ id: 't1' }, { id: 't2' }],
				pagination: { has_next_page: true, next_page: 2 },
			}
			const page2 = {
				data: [{ id: 't3' }],
				pagination: { has_next_page: false, next_page: 2 },
			}

			mockFetch
				.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(page1) })
				.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(page2) })

			const result = await repo.findAllSimple()

			expect(result).toHaveLength(3)
			expect(result.map((t) => t.id)).toEqual(['t1', 't2', 't3'])
			expect(mockFetch).toHaveBeenCalledTimes(2)
			expect(mockFetch.mock.calls[0][0]).toContain('page=1')
			expect(mockFetch.mock.calls[0][0]).toContain('limit=100')
			expect(mockFetch.mock.calls[1][0]).toContain('page=2')
		})

		it('fetches the remaining pages in parallel once the page count is known', async () => {
			const pageOf = (page: number) => ({
				data: [{ id: `t${page}` }],
				pagination: { has_next_page: page < 4, next_page: page + 1, total_pages: 4 },
			})
			const pending: Array<() => void> = []
			mockFetch.mockImplementation((url: string) => {
				const page = Number(new URL(url, 'http://x').searchParams.get('page'))
				const response = { ok: true, json: () => Promise.resolve(pageOf(page)) }
				if (page === 1) return Promise.resolve(response)
				return new Promise((resolve) => pending.push(() => resolve(response)))
			})

			const result = repo.findAllSimple({ date_from: '2024-01-01' })
			await vi.waitFor(() => expect(pending).toHaveLength(3))
			// pages 2..4 are all in flight before any of them answered
			expect(mockFetch).toHaveBeenCalledTimes(4)
			for (const release of pending) release()

			expect((await result).map((t) => t.id)).toEqual(['t1', 't2', 't3', 't4'])
			expect(mockFetch.mock.calls[3][0]).toContain('date_from=2024-01-01')
		})

		it('never loads more than maxPages pages', async () => {
			mockFetch.mockImplementation((url: string) => {
				const page = Number(new URL(url, 'http://x').searchParams.get('page'))
				return Promise.resolve({
					ok: true,
					json: () =>
						Promise.resolve({
							data: [{ id: `t${page}` }],
							pagination: { has_next_page: true, next_page: page + 1, total_pages: 500 },
						}),
				})
			})

			const result = await repo.findAllSimple(undefined, { maxPages: 3 })

			expect(result).toHaveLength(3)
			expect(mockFetch).toHaveBeenCalledTimes(3)
		})
	})

	describe('count', () => {
		it('asks for a single row and reads the total from the pagination', async () => {
			mockFetch.mockResolvedValue({
				ok: true,
				json: () => Promise.resolve({ data: [{ id: 't1' }], pagination: { total_records: 42 } }),
			})

			await expect(repo.count({ budget_id: 'b1', type: 'bill' })).resolves.toBe(42)
			const url = mockFetch.mock.calls[0][0] as string
			expect(url).toContain('budget_id=b1')
			expect(url).toContain('type=bill')
			expect(url).toContain('limit=1')
		})
	})

	describe('create', () => {
		it('posts new transaction', async () => {
			mockFetch.mockResolvedValue({ ok: true, headers: { get: () => null }, json: () => Promise.resolve({}) })
			await repo.create('Test', 'Desc', 100, TypeTransaction.BILL, 'acc1', 'cat1')
			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining('/transaction'),
				expect.objectContaining({ method: 'POST' }),
			)
		})
	})

	describe('update', () => {
		it('puts updated transaction', async () => {
			mockFetch.mockResolvedValue({ ok: true, headers: { get: () => null }, json: () => Promise.resolve({}) })
			await repo.update('1', 'Updated', 'Desc', 200, TypeTransaction.INCOME, 'acc1', 'cat1')
			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining('/transaction/1'),
				expect.objectContaining({ method: 'PUT' }),
			)
		})
	})

	describe('delete', () => {
		it('sends delete request', async () => {
			mockFetch.mockResolvedValue({ ok: true })
			await repo.delete('1')
			expect(mockFetch).toHaveBeenCalledWith(
				expect.stringContaining('/transaction/1'),
				expect.objectContaining({ method: 'DELETE' }),
			)
		})
	})
})
