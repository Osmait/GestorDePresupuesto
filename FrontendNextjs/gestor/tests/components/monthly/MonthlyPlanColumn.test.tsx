import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ComponentProps } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { MonthlyPlanColumn } from '@/components/monthly/MonthlyPlanColumn'
import { MonthlyPlanItem } from '@/types/monthlyPlan'

vi.mock('next-intl', () => ({
	useTranslations: () => (key: string, values?: Record<string, unknown>) => {
		const translations: Record<string, string> = {
			incomeColumn: 'Expected income',
			expensesColumn: 'Fixed expenses',
			total: 'Total',
			add: 'Add',
			noIncomes: 'No income registered yet',
			noExpenses: 'No fixed expenses registered yet',
			addFirstIncome: 'Add income',
			addFirstExpense: 'Add fixed expense',
			paused: 'Paused',
			noFixedDay: 'No fixed day',
			openMenu: 'Open menu',
			actions: 'Actions',
			edit: 'Edit',
			pause: 'Pause',
			resume: 'Resume',
			delete: 'Delete',
		}
		if (key === 'dayOfMonth') return `Day ${values?.day}`
		if (key === 'originalAmount') return `$${values?.amount} USD`
		return translations[key] || key
	},
}))

function makeItem(overrides: Partial<MonthlyPlanItem> = {}): MonthlyPlanItem {
	return {
		id: 'id-1',
		user_id: 'u1',
		name: 'Alquiler',
		description: '',
		amount: 25000,
		amount_dop: 25000,
		currency: 'DOP',
		type: 'bill',
		is_active: true,
		created_at: '2026-07-01T00:00:00Z',
		...overrides,
	}
}

const noop = () => {}

type ColumnProps = ComponentProps<typeof MonthlyPlanColumn>

function renderColumn(items: MonthlyPlanItem[], overrides: Partial<ColumnProps> = {}) {
	const props: ColumnProps = {
		type: 'bill',
		items,
		categoryNames: new Map([['cat-home', 'Hogar']]),
		onCreate: noop,
		onEdit: noop,
		onToggle: noop,
		onDelete: noop,
		...overrides,
	}
	return render(<MonthlyPlanColumn {...props} />)
}

describe('MonthlyPlanColumn', () => {
	it('totals only the active items', () => {
		renderColumn([
			makeItem({ id: '1', amount_dop: 25000 }),
			makeItem({ id: '2', name: 'Internet', amount_dop: 2200 }),
			makeItem({ id: '3', name: 'Gym', amount_dop: 9999, is_active: false }),
		])

		// 25000 + 2200, the paused 9999 excluded.
		expect(screen.getByTestId('column-total-bill')).toHaveTextContent('27,200')
	})

	it('renders every item including the paused ones', () => {
		renderColumn([makeItem({ id: '1' }), makeItem({ id: '2', name: 'Gym', is_active: false })])

		expect(screen.getByText('Alquiler')).toBeInTheDocument()
		expect(screen.getByText('Gym')).toBeInTheDocument()
		expect(screen.getByText('Paused')).toBeInTheDocument()
	})

	it('shows the empty state with a call to action', () => {
		renderColumn([])

		expect(screen.getByText('No fixed expenses registered yet')).toBeInTheDocument()
		expect(screen.getByText('Add fixed expense')).toBeInTheDocument()
	})

	it('shows the income empty state for the income column', () => {
		renderColumn([], { type: 'income' })

		expect(screen.getByText('No income registered yet')).toBeInTheDocument()
	})

	it('marks the day of the month, or says there is none', () => {
		renderColumn([makeItem({ id: '1', day_of_month: 5 }), makeItem({ id: '2', name: 'Imprevistos' })])

		expect(screen.getByText('Day 5')).toBeInTheDocument()
		expect(screen.getByText('No fixed day')).toBeInTheDocument()
	})

	it('shows the original amount for USD items alongside the DOP value', () => {
		renderColumn([makeItem({ id: '1', name: 'Netflix', currency: 'USD', amount: 15, amount_dop: 937.5 })])

		expect(screen.getByText('USD')).toBeInTheDocument()
		expect(screen.getByText('$15.00 USD')).toBeInTheDocument()
	})

	it('resolves the category name', () => {
		renderColumn([makeItem({ id: '1', category_id: 'cat-home' })])

		expect(screen.getByText('Hogar')).toBeInTheDocument()
	})

	it('asks to create an item of its own type', async () => {
		const onCreate = vi.fn()
		renderColumn([makeItem()], { onCreate })

		await userEvent.click(screen.getByRole('button', { name: /Add/i }))

		expect(onCreate).toHaveBeenCalledWith('bill')
	})

	it('hides the total when the column is empty', () => {
		renderColumn([])

		expect(screen.queryByTestId('column-total-bill')).not.toBeInTheDocument()
	})
})
