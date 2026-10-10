import { act, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
	TransactionProvider,
	useTransactionActions,
	useTransactionContext,
} from '@/components/transactions/TransactionContext'

const useGetTransactions = vi.fn()
const routerReplace = vi.fn()
// TanStack's mutateAsync is stable across renders; so are these.
const mutation = { mutateAsync: vi.fn() }

vi.mock('next/navigation', () => ({
	useSearchParams: () => new URLSearchParams(window.location.search),
	useRouter: () => ({ replace: routerReplace, push: vi.fn() }),
}))

vi.mock('@/hooks/queries/useTransactionsQuery', () => ({
	useGetTransactions: (...args: unknown[]) => useGetTransactions(...args),
	useCreateTransactionMutation: () => mutation,
	useDeleteTransactionMutation: () => mutation,
	useUpdateTransactionMutation: () => mutation,
}))

type Context = ReturnType<typeof useTransactionContext>
type Actions = ReturnType<typeof useTransactionActions>

function Probe({ onContext, onActions }: { onContext: (_c: Context) => void; onActions: (_a: Actions) => void }) {
	onContext(useTransactionContext())
	onActions(useTransactionActions())
	return null
}

describe('TransactionProvider', () => {
	beforeEach(() => {
		useGetTransactions.mockReset()
		useGetTransactions.mockReturnValue({ data: undefined, isLoading: false, error: null, refetch: vi.fn() })
		routerReplace.mockReset()
		window.history.replaceState(null, '', '/app/transactions?highlight=t1&open=details')
	})

	it('requests the filtered list from the first render (no unfiltered request)', () => {
		render(
			<TransactionProvider>
				<Probe onContext={() => {}} onActions={() => {}} />
			</TransactionProvider>,
		)

		expect(useGetTransactions).toHaveBeenCalled()
		for (const [filters] of useGetTransactions.mock.calls) {
			expect(filters).toMatchObject({ page: 1, limit: 50, include_summary: true })
			expect(filters.date_from).toMatch(/^\d{4}-\d{2}-\d{2}$/)
		}
	})

	it('mirrors the filters into the URL with history.replaceState, keeping other params', () => {
		let actions: Actions | undefined
		render(
			<TransactionProvider>
				<Probe onContext={() => {}} onActions={(a) => (actions = a)} />
			</TransactionProvider>,
		)

		act(() => actions!.setFilters((f) => ({ ...f, search: 'rent' })))

		const params = new URLSearchParams(window.location.search)
		expect(params.get('search')).toBe('rent')
		expect(params.get('dateFrom')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
		expect(params.get('highlight')).toBe('t1')
		expect(routerReplace).not.toHaveBeenCalled()
		expect(useGetTransactions).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'rent' }), {
			enabled: true,
		})
	})

	it('keeps the actions referentially stable when the filters change', () => {
		const seen: Actions[] = []
		let context: Context | undefined
		render(
			<TransactionProvider>
				<Probe onContext={(c) => (context = c)} onActions={(a) => seen.push(a)} />
			</TransactionProvider>,
		)

		act(() => seen[0].setFilters((f) => ({ ...f, type: 'INCOME' })))

		expect(context!.filters.type).toBe('INCOME')
		expect(new Set(seen).size).toBe(1)
	})

	it('does not load the list when fetchTransactions is false', () => {
		render(
			<TransactionProvider syncUrl={false} fetchTransactions={false}>
				<Probe onContext={() => {}} onActions={() => {}} />
			</TransactionProvider>,
		)

		expect(useGetTransactions).toHaveBeenCalledWith(expect.any(Object), { enabled: false })
		expect(new URLSearchParams(window.location.search).get('dateFrom')).toBeNull()
	})
})
