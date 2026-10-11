import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { AnalysisActions } from '@/components/analysis/AnalysisActions'

// Mock translations
vi.mock('next-intl', () => ({
	useTranslations: () => (key: string) => key,
}))

// Mock context
vi.mock('@/components/analysis/AnalysisContext', () => ({
	createDefaultAnalysisFilters: () => ({}),
	useAnalysisContext: () => ({
		filters: {
			filterMode: 'month',
			month: '01',
			year: '2024',
			dateRange: { from: undefined, to: undefined },
			account: 'all',
			category: 'all',
			type: 'all',
			minAmount: '',
			maxAmount: '',
			search: '',
		},
		setFilters: vi.fn(),
	}),
}))

// Mock hooks
vi.mock('@/hooks/queries/useAccountsQuery', () => ({
	useGetAccounts: () => ({ data: [] }),
}))
vi.mock('@/hooks/queries/useCategoriesQuery', () => ({
	useGetCategories: () => ({ data: [] }),
}))
vi.mock('@/hooks/queries/useAnalyticsQuery', () => ({
	useGetDashboardSummary: () => ({
		data: {
			total_income: 1000,
			total_expenses: 500,
			category_expenses: [
				{ id: 'c1', label: 'Food', value: 300 },
				{ id: 'c2', label: 'Rent', value: 200 },
			],
		},
	}),
}))
vi.mock('@/hooks/queries/useBudgetsQuery', () => ({
	useGetBudgets: () => ({ data: [] }),
}))

// Desktop layout: tools open as floating, non-modal dialogs (mobile uses a vaul drawer)
vi.mock('@/hooks/useMediaQuery', () => ({
	BREAKPOINTS: { md: '(min-width: 768px)' },
	useMediaQuery: () => true,
}))

// Mock filters form
vi.mock('@/components/analysis/AnalysisFilters', () => ({
	AnalysisFiltersForm: () => <div data-testid='filters-form'>Filters Form</div>,
}))

describe('AnalysisActions', () => {
	it('renders filter button', () => {
		render(<AnalysisActions />)
		expect(screen.getByText('filter')).toBeInTheDocument()
	})

	it('opens drawer when filter button is clicked', async () => {
		const user = userEvent.setup()
		render(<AnalysisActions />)

		await user.click(screen.getByText('filter'))

		expect(await screen.findByText('filterAnalytics')).toBeInTheDocument()
		expect(await screen.findByTestId('filters-form')).toBeInTheDocument()
	})

	it('opens a tool as a labelled dialog that closes with its close button', async () => {
		const user = userEvent.setup()
		render(<AnalysisActions />)

		await user.click(screen.getByRole('button', { name: 'tools' }))
		await user.click(await screen.findByRole('menuitem', { name: 'toolProjectionTitle' }))

		const dialog = await screen.findByRole('dialog', { name: 'toolProjectionTitle' })
		expect(dialog).toBeInTheDocument()

		await user.click(screen.getByRole('button', { name: 'toolClose' }))
		expect(screen.queryByRole('dialog', { name: 'toolProjectionTitle' })).not.toBeInTheDocument()
	})

	it('closes a tool window with Escape', async () => {
		const user = userEvent.setup()
		render(<AnalysisActions />)

		await user.click(screen.getByRole('button', { name: 'tools' }))
		await user.click(await screen.findByRole('menuitem', { name: 'toolExportTitle' }))
		const dialog = await screen.findByRole('dialog', { name: 'toolExportTitle' })

		dialog.focus()
		await user.keyboard('{Escape}')
		expect(screen.queryByRole('dialog', { name: 'toolExportTitle' })).not.toBeInTheDocument()
	})
})
