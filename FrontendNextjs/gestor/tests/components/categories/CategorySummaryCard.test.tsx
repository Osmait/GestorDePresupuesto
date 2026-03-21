import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { CategorySummaryCard } from '@/components/categories/CategorySummaryCard'

vi.mock('next-intl', () => ({
	useTranslations: () => (key: string) => {
		const translations: Record<string, string> = {
			summary: 'Summary',
			totalCategories: 'Total Categories',
			activeCategories: 'Active Categories',
			averagePerCategory: 'Avg Per Category',
		}
		return translations[key] || key
	},
}))

vi.mock('@/components/ui/animated-counter', () => ({
	AnimatedCounter: ({ value }: { value: number }) => <span>{value}</span>,
}))

describe('CategorySummaryCard', () => {
	const mockCategories = [
		{ id: 'c1', name: 'Food', icon: '🍔', color: '#FF0000', user_id: 'u1', created_at: '', updated_at: '' },
		{ id: 'c2', name: 'Transport', icon: '🚗', color: '#00FF00', user_id: 'u1', created_at: '', updated_at: '' },
		{ id: 'c3', name: 'Entertainment', icon: '🎬', color: '#0000FF', user_id: 'u1', created_at: '', updated_at: '' },
	]

	const mockCategoryExpenses = [
		{ id: 'c1', label: 'Food', value: 80, color: '#FF0000', transaction_count: 2, dop_total: 80, usd_total: 0 },
		{ id: 'c2', label: 'Transport', value: 100, color: '#00FF00', transaction_count: 1, dop_total: 100, usd_total: 0 },
	]

	it('calculates totals correctly', () => {
		render(<CategorySummaryCard categories={mockCategories} categoryExpenses={mockCategoryExpenses} />)

		expect(screen.getByText('Summary')).toBeInTheDocument()

		// Total Categories: 3
		expect(screen.getByText('Total Categories')).toBeInTheDocument()
		expect(screen.getByText('3')).toBeInTheDocument()

		// Active Categories: 2 (c1 and c2 have transactions)
		expect(screen.getByText('Active Categories')).toBeInTheDocument()
		// Average is also 2. Both Active Categories and Average are 2, so use getAllByText
		expect(screen.getAllByText('2')).toHaveLength(2)

		// Average: 3 transactions / 2 active categories = 1.5 -> rounded to 2
		expect(screen.getByText('Avg Per Category')).toBeInTheDocument()
	})
})
