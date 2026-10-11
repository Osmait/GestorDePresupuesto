import { screen } from '@testing-library/react'
import { CategorySummaryCard } from '@/components/categories/CategorySummaryCard'
import { renderWithIntl } from '@/tests/utils/intl'

function statValue(label: string) {
	const card = screen.getByText(label).closest('.p-5') as HTMLElement
	return card.querySelector('.text-2xl') as HTMLElement
}

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

	it('calculates totals in StatCards', () => {
		renderWithIntl(<CategorySummaryCard categories={mockCategories} categoryExpenses={mockCategoryExpenses} />)

		expect(statValue('Total Categories')).toHaveTextContent('3')
		// c1 and c2 have transactions.
		expect(statValue('Active Categories')).toHaveTextContent('2')
		// 3 transactions / 2 active categories = 1.5 -> 2
		expect(statValue('Average per Category')).toHaveTextContent('2')
	})
})
