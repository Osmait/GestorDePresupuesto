import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { TransactionActions } from '@/components/transactions/TransactionActions'

const { setFilters } = vi.hoisted(() => ({ setFilters: vi.fn() }))

// Mock hooks
vi.mock('@/components/transactions/TransactionContext', () => ({
	useTransactionContext: () => ({
		openModal: vi.fn(),
		setOpenModal: vi.fn(),
		filters: { search: '', minAmount: '', maxAmount: '', type: 'all', account: 'all', category: 'all' },
		setFilters,
	}),
}))

vi.mock('@/hooks/queries/useAccountsQuery', () => ({
	useGetAccounts: () => ({ data: [{ id: 'a1', name: 'Account 1' }], isLoading: false }),
}))

vi.mock('@/hooks/queries/useCategoriesQuery', () => ({
	useGetCategories: () => ({ data: [{ id: 'c1', name: 'Category 1' }], isLoading: false }),
}))

vi.mock('@/hooks/queries/useAIQuery', () => ({
	useExtractFromFile: () => ({
		extract: vi.fn(),
		isExtracting: false,
		extractData: null,
		reset: vi.fn(),
	}),
	useAnalyzeSpendingMutation: () => ({
		mutateAsync: vi.fn(),
		isPending: false,
	}),
	useReconciliationPreviewMutation: () => ({
		mutateAsync: vi.fn(),
		isPending: false,
		data: null,
	}),
	useReconciliationApplyMutation: () => ({
		mutateAsync: vi.fn(),
		isPending: false,
		data: null,
	}),
	useSavingsPlanMutation: () => ({
		mutateAsync: vi.fn(),
		isPending: false,
		data: null,
	}),
}))

vi.mock('next-intl', () => ({
	useTranslations: () => (key: string) => key,
}))

vi.mock('@/hooks/useFeatureFlags', () => ({
	useFeatureFlags: () => ({
		flags: {
			ai_extraction: true,
			ai_reconciliation: true,
			ai_savings_plan: true,
		},
		isLoading: false,
		isEnabled: (key: string) => ['ai_extraction', 'ai_reconciliation', 'ai_savings_plan'].includes(key),
		refresh: vi.fn(),
	}),
}))

vi.mock('@/components/ai', () => ({
	AIExtractionButton: () => <button type='button'>extractFromDocument</button>,
	SpendingInsightsModal: () => <div data-testid='spending-insights-modal'>Insights Modal</div>,
	ReconciliationModal: () => <div data-testid='reconciliation-modal'>Reconciliation Modal</div>,
	SavingsPlanModal: () => <div data-testid='savings-plan-modal'>Savings Plan Modal</div>,
}))

// Mock child components
vi.mock('@/components/transactions/TransactionFormModal', () => ({
	default: () => <div data-testid='transaction-form-modal'>Form</div>,
}))

vi.mock('@/components/transactions/TransactionSort', () => ({
	TransactionSort: () => <div data-testid='transaction-sort'>Sort</div>,
}))

vi.mock('@/components/ai/AIExtractionModal', () => ({
	AIExtractionModal: () => <div data-testid='ai-extraction-modal'>AI Modal</div>,
}))

function renderActions() {
	const queryClient = new QueryClient({
		defaultOptions: {
			queries: { retry: false },
			mutations: { retry: false },
		},
	})
	return render(
		<QueryClientProvider client={queryClient}>
			<TransactionActions />
		</QueryClientProvider>,
	)
}

describe('TransactionActions', () => {
	it('renders action buttons', () => {
		renderActions()

		expect(screen.getByText('addTransaction')).toBeInTheDocument()
		expect(screen.getByText('filters')).toBeInTheDocument()
	})

	it('opens filter drawer on click', async () => {
		const user = userEvent.setup()
		renderActions()

		await user.click(screen.getByText('filters'))

		expect(await screen.findByText('filterTransactions')).toBeInTheDocument()
	})

	it('debounces the search box: one filter update after the user stops typing', async () => {
		setFilters.mockClear()
		const user = userEvent.setup()
		renderActions()
		await user.click(screen.getByText('filters'))
		const input = await screen.findByPlaceholderText('searchPlaceholder')

		vi.useFakeTimers()
		try {
			// One change per keystroke, 120 ms apart (vaul's drawer does not support
			// user-event pointer sequences in jsdom).
			const text = 'Gasto 12'
			for (let i = 1; i <= text.length; i++) {
				fireEvent.change(input, { target: { value: text.slice(0, i) } })
				act(() => {
					vi.advanceTimersByTime(120)
				})
			}
			expect(input).toHaveValue('Gasto 12')
			expect(setFilters).not.toHaveBeenCalled()

			await act(async () => {
				vi.advanceTimersByTime(300)
			})
			expect(setFilters).toHaveBeenCalledTimes(1)
			const update = setFilters.mock.calls[0][0]
			expect(update({ search: '' })).toEqual({ search: 'Gasto 12' })
		} finally {
			vi.useRealTimers()
		}
	})
})
