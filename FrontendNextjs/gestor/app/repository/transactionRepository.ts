import { BaseRepository } from '@/lib/base-repository'
import { PaginatedTransactionResponse, Transaction, TransactionFilters, TypeTransaction } from '@/types/transaction'

/** Backend maximum page size. */
const SIMPLE_PAGE_SIZE = 100
/** findAllSimple never loads more than this many pages (2,000 transactions). */
const SIMPLE_MAX_PAGES = 20
/** Pages requested at the same time by findAllSimple. */
const SIMPLE_PAGE_CONCURRENCY = 4

/** Runs `fn` over `items` with at most `limit` calls in flight; results keep the input order. */
async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
	const results = new Array<R>(items.length)
	let next = 0
	async function worker() {
		while (next < items.length) {
			const index = next++
			results[index] = await fn(items[index])
		}
	}
	await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
	return results
}

export class TransactionRepository extends BaseRepository {
	private getTypeTransactionString(typeTransaction: TypeTransaction): string {
		if (typeTransaction === TypeTransaction.INCOME) return 'income'
		if (typeTransaction === TypeTransaction.BILL) return 'bill'
		return ''
	}

	private buildTransactionBody(
		name: string,
		description: string,
		amount: number,
		typeTransaction: TypeTransaction,
		account_id: string,
		category_id: string,
		budget_id?: string,
		currency?: string,
	) {
		const body: Record<string, any> = {
			name,
			description,
			amount,
			type_transation: this.getTypeTransactionString(typeTransaction),
			account_id,
			category_id,
			budget_id: budget_id || null,
			currency: currency && currency.length === 3 ? currency : 'DOP',
		}
		return body
	}

	async findAll(filters?: TransactionFilters): Promise<PaginatedTransactionResponse> {
		try {
			const queryParams = new URLSearchParams()

			if (filters) {
				Object.entries(filters).forEach(([key, value]) => {
					if (value !== undefined && value !== null && value !== '') {
						queryParams.append(key, String(value))
					}
				})
			}

			const url = `/transaction${queryParams.toString() ? `?${queryParams.toString()}` : ''}`
			const response = await this.get<PaginatedTransactionResponse>(url)
			return response
		} catch (error) {
			console.error('Error fetching transactions:', error)
			return {
				data: [],
				pagination: {
					current_page: 1,
					has_next_page: false,
					has_prev_page: false,
					next_page: 1,
					per_page: 20,
					prev_page: 1,
					total_pages: 1,
					total_records: 0,
				},
			}
		}
	}

	/**
	 * Every transaction matching `filters`, newest first, in pages of 100 (the
	 * backend maximum). After the first page, the remaining ones are fetched in
	 * parallel (at most SIMPLE_PAGE_CONCURRENCY at a time) and the total is
	 * capped at `maxPages` pages. Prefer an aggregate or a single page when
	 * the caller does not need every row.
	 */
	async findAllSimple(
		filters?: TransactionFilters,
		{ maxPages = SIMPLE_MAX_PAGES }: { maxPages?: number } = {},
	): Promise<Transaction[]> {
		try {
			const query: TransactionFilters = {
				...filters,
				limit: SIMPLE_PAGE_SIZE,
				sort_by: 'created_at',
				sort_order: 'desc',
			}
			const first = await this.findAll({ ...query, page: 1 })
			const pages: Transaction[][] = [first.data || []]
			const pagination = first.pagination
			if (!pagination?.has_next_page || pages[0].length === 0 || maxPages <= 1) return pages[0]

			const totalPages = Number(pagination.total_pages)
			if (Number.isFinite(totalPages) && totalPages > 1) {
				const pageNumbers = Array.from({ length: Math.min(totalPages, maxPages) - 1 }, (_, i) => i + 2)
				const rest = await mapWithConcurrency(pageNumbers, SIMPLE_PAGE_CONCURRENCY, async (page) => {
					const response = await this.findAll({ ...query, page })
					return response.data || []
				})
				pages.push(...rest)
			} else {
				// No page count from the backend: follow has_next_page, still bounded by maxPages.
				let response = first
				let page = 1
				while (response.pagination?.has_next_page && page < maxPages) {
					const nextPage = response.pagination.next_page
					page = typeof nextPage === 'number' && nextPage > page ? nextPage : page + 1
					response = await this.findAll({ ...query, page })
					const data = response.data || []
					if (data.length === 0) break
					pages.push(data)
				}
			}

			// Rows can shift between pages when data changes mid-way: keep each id once.
			const seen = new Set<string>()
			return pages.flat().filter((transaction) => {
				if (seen.has(transaction.id)) return false
				seen.add(transaction.id)
				return true
			})
		} catch (error) {
			console.error('Error fetching simple transactions:', error)
			return []
		}
	}

	/** Number of transactions matching `filters` (one row requested; the count comes from the pagination). */
	async count(filters: Omit<TransactionFilters, 'page' | 'limit' | 'offset'>): Promise<number> {
		const response = await this.findAll({ ...filters, page: 1, limit: 1 })
		const total = Number(response.pagination?.total_records)
		return Number.isFinite(total) ? total : (response.data || []).length
	}

	async create(
		name: string,
		description: string,
		amount: number,
		typeTransaction: TypeTransaction,
		account_id: string,
		category_id: string,
		budget_id?: string,
		currency?: string,
		created_at?: Date,
	): Promise<void> {
		try {
			const body = {
				...this.buildTransactionBody(
					name,
					description,
					amount,
					typeTransaction,
					account_id,
					category_id,
					budget_id,
					currency,
				),
				created_at: created_at ? created_at.toISOString() : new Date().toISOString(),
			}

			await this.post('/transaction', body)
		} catch (error) {
			console.error('[TransactionRepository] Error creating transaction:', error)
			throw error
		}
	}

	async update(
		id: string,
		name: string,
		description: string,
		amount: number,
		typeTransaction: TypeTransaction,
		account_id: string,
		category_id: string,
		budget_id?: string,
		currency?: string,
		created_at?: Date,
	): Promise<void> {
		try {
			const body = {
				...this.buildTransactionBody(
					name,
					description,
					amount,
					typeTransaction,
					account_id,
					category_id,
					budget_id,
					currency,
				),
				created_at: created_at ? created_at.toISOString() : undefined,
			}
			await this.put(`/transaction/${id}`, body)
		} catch (error) {
			console.error('Error updating transaction:', error)
			throw error
		}
	}

	async delete(id: string): Promise<void> {
		try {
			await this.deleteRequest(`/transaction/${id}`)
		} catch (error) {
			console.error('Error deleting transaction:', error)
			throw error
		}
	}

	async findById(id: string): Promise<Transaction | null> {
		try {
			return await this.get<Transaction>(`/transaction/${id}`)
		} catch (error) {
			console.error('Error fetching transaction by id:', error)
			return null
		}
	}
}
