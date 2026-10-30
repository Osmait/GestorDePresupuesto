import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FINANCIAL_QUERY_ROOTS } from '@/hooks/queries/invalidateFinancialData'
import { CREDIT_CARD_KEYS, useUpdateCreditCardMutation } from '@/hooks/queries/useCreditCardsQuery'

const mockUpdate = vi.fn()
const mockUpdateBalance = vi.fn()

vi.mock('@/lib/repositoryConfig', () => ({
	getCreditCardRepository: () => Promise.resolve({ update: mockUpdate, updateBalance: mockUpdateBalance }),
}))

let queryClient: QueryClient

function Wrapper({ children }: { children: ReactNode }) {
	return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

function setup() {
	queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
	const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
	const { result } = renderHook(() => useUpdateCreditCardMutation(), { wrapper: Wrapper })
	const invalidatedKeys = () => invalidate.mock.calls.map(([filters]) => filters?.queryKey)
	return { result, invalidatedKeys }
}

const card = { name: 'Visa Oro', bank: 'Banco Popular', cut_day: 15, due_day: 5 }

describe('useUpdateCreditCardMutation', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockUpdate.mockResolvedValue({ id: 'card1' })
		mockUpdateBalance.mockResolvedValue({})
	})

	it('saves the card fields and each changed limit through the balance endpoint', async () => {
		const { result, invalidatedKeys } = setup()

		await act(() =>
			result.current.mutateAsync({
				id: 'card1',
				data: {
					card,
					creditLimits: [
						{ balanceId: 'bal-dop', credit_limit: 150000 },
						{ balanceId: 'bal-usd', credit_limit: 2500.75 },
					],
				},
			}),
		)

		// The card update carries no balances: the backend ignores them there.
		expect(mockUpdate).toHaveBeenCalledWith('card1', card)
		expect(mockUpdateBalance).toHaveBeenNthCalledWith(1, 'card1', 'bal-dop', { credit_limit: 150000 })
		expect(mockUpdateBalance).toHaveBeenNthCalledWith(2, 'card1', 'bal-usd', { credit_limit: 2500.75 })
		const keys = invalidatedKeys()
		expect(keys).toEqual(expect.arrayContaining([...FINANCIAL_QUERY_ROOTS]))
		expect(keys).toEqual(
			expect.arrayContaining([CREDIT_CARD_KEYS.lists(), CREDIT_CARD_KEYS.summary(), CREDIT_CARD_KEYS.detail('card1')]),
		)
	})

	it('does not call the balance endpoint when no limit changed', async () => {
		const { result } = setup()

		await act(() => result.current.mutateAsync({ id: 'card1', data: { card, creditLimits: [] } }))

		expect(mockUpdate).toHaveBeenCalledTimes(1)
		expect(mockUpdateBalance).not.toHaveBeenCalled()
	})

	it('still refreshes the cards when a limit update fails after the card was saved', async () => {
		mockUpdateBalance.mockRejectedValueOnce(new Error('credit_limit must be greater than 0'))
		const { result, invalidatedKeys } = setup()

		await act(async () => {
			await expect(
				result.current.mutateAsync({
					id: 'card1',
					data: { card, creditLimits: [{ balanceId: 'bal-dop', credit_limit: 1 }] },
				}),
			).rejects.toThrow('credit_limit must be greater than 0')
		})

		expect(invalidatedKeys()).toEqual(expect.arrayContaining([CREDIT_CARD_KEYS.lists()]))
	})
})
