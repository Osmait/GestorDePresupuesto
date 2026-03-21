import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { AIExtractionModal } from '@/components/ai/AIExtractionModal'

// --- Mock data ---

const transactionsWithMissingCategory = [
	{
		id: 'txn-1',
		name: 'Grocery Store',
		description: 'Weekly groceries',
		amount: 1500,
		type_transation: 'bill',
		account_id: 'acc-1',
		category_id: 'cat-1',
		currency: 'DOP',
		created_at: '2026-03-21',
	},
	{
		id: 'txn-2',
		name: 'Unknown Purchase',
		description: 'Unrecognized merchant',
		amount: 500,
		type_transation: 'bill',
		account_id: 'acc-1',
		category_id: '', // NO CATEGORY
		currency: 'DOP',
		created_at: '2026-03-21',
	},
	{
		id: 'txn-3',
		name: 'Gas Station',
		description: 'Fuel',
		amount: 2000,
		type_transation: 'bill',
		account_id: 'acc-1',
		category_id: 'cat-2',
		currency: 'DOP',
		created_at: '2026-03-21',
	},
]

const transactionsAllWithCategory = [
	{
		id: 'txn-1',
		name: 'Grocery Store',
		amount: 1500,
		type_transation: 'bill',
		account_id: 'acc-1',
		category_id: 'cat-1',
		currency: 'DOP',
		created_at: '2026-03-21',
	},
	{
		id: 'txn-2',
		name: 'Gas Station',
		amount: 2000,
		type_transation: 'bill',
		account_id: 'acc-1',
		category_id: 'cat-2',
		currency: 'DOP',
		created_at: '2026-03-21',
	},
]

function makeExtractResponse(transactions: any[]) {
	return {
		success: true,
		data: {
			transactions,
			count: transactions.length,
			potential_duplicates: [],
			category_suggestions: [],
		},
	}
}

// --- Mocks ---

const mockExtract = vi.fn()

vi.mock('next-intl', () => ({
	useTranslations: () => (key: string, params?: any) => {
		const translations: Record<string, string> = {
			title: 'Extract Transactions with AI',
			description: 'Upload receipts to extract transactions',
			account: 'Account',
			selectAccount: 'Select account',
			documentType: 'Document Type',
			receipt: 'Receipt',
			extractButton: 'Extract Transactions',
			saveTransactions: `Save ${params?.count ?? 0} Transactions`,
			needCategory: `${params?.count ?? 0} need category`,
			selectedCount: `${params?.selected ?? 0} of ${params?.total ?? 0} selected`,
			selectAll: 'Select All',
			deselectAll: 'Deselect All',
			transactionsFound: `${params?.count ?? 0} transactions found`,
			extractedCount: `${params?.count ?? 0} transactions extracted`,
			failedToExtract: 'Failed to extract',
			noCategoryMatched: 'No category matched',
			name: 'Name',
			amount: 'Amount',
			cancel: 'Cancel',
			save: 'Save',
			back: 'Back',
		}
		return translations[key] || key
	},
}))

vi.mock('@/hooks/queries/useAccountsQuery', () => ({
	useGetAccounts: () => ({
		data: [{ id: 'acc-1', name: 'Main Account', currency: 'DOP' }],
		isLoading: false,
	}),
}))

vi.mock('@/hooks/queries/useCategoriesQuery', () => ({
	useGetCategories: () => ({
		data: [
			{ id: 'cat-1', name: 'Food', icon: '🍔', color: '#ff0000' },
			{ id: 'cat-2', name: 'Transport', icon: '🚗', color: '#00ff00' },
		],
		isLoading: false,
		refetch: vi.fn(),
	}),
	useCreateCategoryMutation: () => ({
		mutateAsync: vi.fn(),
		isPending: false,
	}),
}))

vi.mock('@/hooks/queries/useTransactionsQuery', () => ({
	useCreateTransactionMutation: () => ({
		mutateAsync: vi.fn(),
		isPending: false,
	}),
}))

vi.mock('@/hooks/queries/useAIQuery', () => ({
	useExtractFromFile: () => ({
		extract: mockExtract,
		isExtracting: false,
		extractData: null,
		reset: vi.fn(),
	}),
}))

vi.mock('@/hooks/useFeatureFlags', () => ({
	useFeatureFlags: () => ({
		isEnabled: () => true,
		isLoading: false,
	}),
}))

vi.mock('@/components/ai/DocumentUploader', () => ({
	DocumentUploader: ({ onFilesSelected }: any) => (
		<button type='button' onClick={() => onFilesSelected([new File(['test'], 'receipt.pdf')])}>
			Mock Upload
		</button>
	),
}))

vi.mock('@/components/ai/QuickCategoryCreate', () => ({
	QuickCategoryCreate: () => null,
}))

// Simplified TransactionPreview that exposes checkboxes for testing
vi.mock('@/components/ai/TransactionPreview', () => ({
	TransactionPreview: ({ transactions, selectedIndices, onSelect }: any) => (
		<div data-testid='transaction-preview'>
			{transactions.map((txn: any, i: number) => (
				<div key={txn.id} data-testid={`txn-${i}`}>
					<label>
						<input
							type='checkbox'
							data-testid={`txn-checkbox-${i}`}
							checked={selectedIndices.has(i)}
							onChange={(e) => onSelect(i, e.target.checked)}
						/>
						{txn.name} {txn.category_id ? `[${txn.category_id}]` : '[NO CATEGORY]'}
					</label>
				</div>
			))}
		</div>
	),
}))

function renderModal() {
	const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
	return render(
		<QueryClientProvider client={queryClient}>
			<AIExtractionModal open={true} onOpenChange={vi.fn()} defaultAccountId='acc-1' />
		</QueryClientProvider>,
	)
}

async function extractAndGoToPreview(user: ReturnType<typeof userEvent.setup>, transactions: any[]) {
	mockExtract.mockResolvedValueOnce(makeExtractResponse(transactions))

	// Upload file
	await user.click(screen.getByText('Mock Upload'))
	// Click extract
	await user.click(screen.getByText('Extract Transactions'))

	// Wait for preview to render
	await waitFor(() => {
		expect(screen.getByTestId('transaction-preview')).toBeInTheDocument()
	})
}

describe('AIExtractionModal - MYP-32: Block submit when category is missing', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it('disables save button when a selected transaction has no category', async () => {
		const user = userEvent.setup()
		renderModal()

		await extractAndGoToPreview(user, transactionsWithMissingCategory)

		// All 3 transactions are auto-selected (none are duplicates)
		// txn-2 has no category → save should be disabled
		const saveButton = screen.getByText(/Save.*Transactions/i)
		expect(saveButton).toBeDisabled()
	})

	it('shows warning count for transactions missing categories', async () => {
		const user = userEvent.setup()
		renderModal()

		await extractAndGoToPreview(user, transactionsWithMissingCategory)

		// 1 transaction missing category
		expect(screen.getByText(/1 need category/i)).toBeInTheDocument()
	})

	it('enables save button when transaction without category is deselected', async () => {
		const user = userEvent.setup()
		renderModal()

		await extractAndGoToPreview(user, transactionsWithMissingCategory)

		// Deselect the one without category (index 1)
		await user.click(screen.getByTestId('txn-checkbox-1'))

		const saveButton = screen.getByText(/Save.*Transactions/i)
		expect(saveButton).not.toBeDisabled()
	})

	it('enables save button when all transactions have categories', async () => {
		const user = userEvent.setup()
		renderModal()

		await extractAndGoToPreview(user, transactionsAllWithCategory)

		const saveButton = screen.getByText(/Save.*Transactions/i)
		expect(saveButton).not.toBeDisabled()
	})

	it('disables save button when no transactions are selected', async () => {
		const user = userEvent.setup()
		renderModal()

		await extractAndGoToPreview(user, transactionsAllWithCategory)

		// Deselect all
		await user.click(screen.getByTestId('txn-checkbox-0'))
		await user.click(screen.getByTestId('txn-checkbox-1'))

		const saveButton = screen.getByText(/Save.*Transactions/i)
		expect(saveButton).toBeDisabled()
	})
})
