import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ComponentProps } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MonthlyPlanLedger } from '@/components/monthly/MonthlyPlanLedger'
import { renderWithIntl } from '@/tests/utils/intl'
import type { Category } from '@/types/category'
import { MonthlyPlanItem } from '@/types/monthlyPlan'

function makeItem(overrides: Partial<MonthlyPlanItem> = {}): MonthlyPlanItem {
	return {
		id: 'id-1',
		user_id: 'user-1',
		name: 'Item',
		description: '',
		amount: 1000,
		amount_dop: 1000,
		currency: 'DOP',
		type: 'bill',
		is_active: true,
		created_at: '2026-07-01T00:00:00Z',
		...overrides,
	}
}

const categories: Category[] = [
	{ id: 'home', name: 'Housing', icon: '🏠', color: '#2a78d6', created_at: '' },
	{ id: 'subs', name: 'Subscriptions', icon: '📺', color: '', created_at: '' },
]

const ITEMS = [
	makeItem({ id: 'salary', name: 'Salary', type: 'income', amount: 88000, amount_dop: 88000, day_of_month: 15 }),
	makeItem({ id: 'rent', name: 'Rent', category_id: 'home', amount: 38000, amount_dop: 38000, day_of_month: 1 }),
	makeItem({
		id: 'netflix',
		name: 'Netflix',
		category_id: 'subs',
		currency: 'USD',
		amount: 15.49,
		amount_dop: 938.22,
		day_of_month: 14,
	}),
	makeItem({ id: 'groceries', name: 'Groceries', amount: 22000, amount_dop: 22000 }),
	makeItem({
		id: 'gym',
		name: 'Gym',
		category_id: 'home',
		amount: 2800,
		amount_dop: 2800,
		day_of_month: 9,
		is_active: false,
	}),
]

// October 11th 2026: week 2 (8–15) is the current one.
const TODAY = { year: 2026, month: 9, day: 11 }

type Props = ComponentProps<typeof MonthlyPlanLedger>

function renderLedger(overrides: Partial<Props> = {}) {
	const props: Props = {
		items: ITEMS,
		categories,
		today: TODAY,
		onEdit: vi.fn(),
		onToggle: vi.fn(),
		onDelete: vi.fn(),
		...overrides,
	}
	return { ...renderWithIntl(<MonthlyPlanLedger {...props} />), props }
}

function groupButton(name: RegExp) {
	return screen.getByRole('button', { name })
}

/** The header button of a group (the group also holds the rows' menu buttons). */
function headerOf(key: string) {
	return within(within(screen.getByTestId(`plan-group-${key}`)).getByRole('heading')).getByRole('button')
}

function rowNames() {
	return screen.queryAllByTestId(/^plan-item-/).map((row) => row.getAttribute('data-testid'))
}

beforeEach(() => window.localStorage.clear())
afterEach(() => window.localStorage.clear())

describe('MonthlyPlanLedger', () => {
	it('groups by category with the expected income first and the biggest category next', () => {
		renderLedger()

		const headings = screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent ?? '')
		expect(headings[0]).toMatch(/^Expected income/)
		expect(headings[1]).toMatch(/^Housing/)
		expect(headings[2]).toMatch(/^No category/)
		expect(headings[3]).toMatch(/^Subscriptions/)
	})

	it('shows each group count, share of expenses and signed subtotal', () => {
		renderLedger()

		const header = headerOf('category:home')
		expect(header).toHaveAttribute('aria-expanded', 'true')
		expect(header).toHaveTextContent('2 items')
		// 38,000 of 60,938.22 active expenses; the paused gym counts in neither.
		expect(header).toHaveTextContent('62.4%')
		expect(header).toHaveTextContent('-RD$38,000.00')
		expect(headerOf('income')).toHaveTextContent('+RD$88,000.00')
	})

	it('falls back to the chart palette when a category has no color', () => {
		renderLedger()

		const dot = headerOf('category:subs').querySelector('span[style]')
		expect(dot?.getAttribute('style')).toContain('var(--color-chart-2)')
	})

	it('renders rows with a 2-digit day, the USD original and a paused badge', () => {
		renderLedger()

		const netflix = screen.getByTestId('plan-item-netflix')
		expect(netflix).toHaveTextContent('14')
		expect(within(netflix).getAllByText('US$15.49').length).toBeGreaterThan(0)
		expect(netflix).toHaveTextContent('-RD$938.22')

		const groceries = screen.getByTestId('plan-item-groceries')
		expect(groceries).toHaveTextContent('—')
		expect(within(groceries).getByText('No fixed day')).toHaveClass('sr-only')

		const gym = screen.getByTestId('plan-item-gym')
		expect(within(gym).getByText('Paused')).toBeInTheDocument()
		expect(within(gym).getByText('-RD$2,800.00')).toHaveClass('line-through')
	})

	it('groups by week with "This week" on the current one and undated items last', async () => {
		const user = userEvent.setup()
		renderLedger()

		await user.click(screen.getByRole('button', { name: 'Week' }))

		expect(screen.getByRole('button', { name: 'Week' })).toHaveAttribute('aria-pressed', 'true')
		const headings = screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent ?? '')
		expect(headings).toHaveLength(3)
		expect(headings[0]).toMatch(/^Oct 1 – 7/)
		expect(headings[1]).toMatch(/^Oct 8 – 15This week/)
		expect(headings[2]).toMatch(/^No fixed day/)
		// Category shown on each row when not grouped by category.
		expect(within(screen.getByTestId('plan-item-rent')).getAllByText('Housing').length).toBeGreaterThan(0)
	})

	it('shows everything in one group when not grouped', async () => {
		const user = userEvent.setup()
		renderLedger()

		await user.click(screen.getByRole('button', { name: 'No grouping' }))

		expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(1)
		expect(rowNames()).toEqual([
			'plan-item-rent',
			'plan-item-gym',
			'plan-item-netflix',
			'plan-item-salary',
			'plan-item-groceries',
		])
	})

	it('filters by name and says so when nothing matches', async () => {
		const user = userEvent.setup()
		renderLedger()

		await user.type(screen.getByRole('searchbox', { name: 'Search items' }), 'net')
		expect(rowNames()).toEqual(['plan-item-netflix'])

		await user.clear(screen.getByRole('searchbox', { name: 'Search items' }))
		await user.type(screen.getByRole('searchbox', { name: 'Search items' }), 'zzz')
		expect(rowNames()).toEqual([])
		expect(screen.getByText('No items found')).toBeInTheDocument()
		expect(screen.getByText('No item matches “zzz”.')).toBeInTheDocument()
	})

	it('opens collapsed groups while searching', async () => {
		const user = userEvent.setup()
		renderLedger()

		await user.click(groupButton(/^Subscriptions/))
		expect(screen.queryByTestId('plan-item-netflix')).not.toBeInTheDocument()

		await user.type(screen.getByRole('searchbox', { name: 'Search items' }), 'netf')
		expect(screen.getByTestId('plan-item-netflix')).toBeInTheDocument()
		expect(groupButton(/^Subscriptions/)).toHaveAttribute('aria-expanded', 'true')
	})

	it('hides and shows the paused items', async () => {
		const user = userEvent.setup()
		renderLedger()

		const toggle = screen.getByRole('button', { name: 'Paused (1)' })
		expect(toggle).toHaveAttribute('aria-pressed', 'true')
		expect(screen.getByTestId('plan-item-gym')).toBeInTheDocument()

		await user.click(toggle)
		expect(toggle).toHaveAttribute('aria-pressed', 'false')
		expect(screen.queryByTestId('plan-item-gym')).not.toBeInTheDocument()
	})

	it('collapses and expands every group', async () => {
		const user = userEvent.setup()
		renderLedger()

		await user.click(screen.getByRole('button', { name: 'Collapse all' }))
		expect(rowNames()).toEqual([])
		for (const button of screen.getAllByRole('button', { expanded: false })) expect(button).toBeInTheDocument()

		await user.click(screen.getByRole('button', { name: 'Expand all' }))
		expect(rowNames()).toHaveLength(ITEMS.length)
	})

	it('remembers collapsed groups and the grouping per user', async () => {
		const user = userEvent.setup()
		const { unmount } = renderLedger()

		await user.click(groupButton(/^Housing/))
		await user.click(screen.getByRole('button', { name: 'No grouping' }))
		await user.click(screen.getByRole('button', { name: 'Category' }))
		unmount()

		renderLedger()
		expect(groupButton(/^Housing/)).toHaveAttribute('aria-expanded', 'false')
		expect(screen.queryByTestId('plan-item-rent')).not.toBeInTheDocument()
		expect(JSON.parse(window.localStorage.getItem('sbf:monthly-plan:ledger:user-1') ?? '{}')).toMatchObject({
			groupBy: 'category',
			collapsed: { 'category:home': true },
		})
	})

	it('restores the stored grouping and survives a corrupt value', () => {
		window.localStorage.setItem('sbf:monthly-plan:ledger:user-1', JSON.stringify({ groupBy: 'week', collapsed: {} }))
		const { unmount } = renderLedger()
		expect(screen.getByRole('button', { name: 'Week' })).toHaveAttribute('aria-pressed', 'true')
		unmount()

		window.localStorage.setItem('sbf:monthly-plan:ledger:user-1', '{not json')
		renderLedger()
		expect(screen.getByRole('button', { name: 'Category' })).toHaveAttribute('aria-pressed', 'true')
	})

	it('totals the active fixed expenses only', () => {
		renderLedger()

		expect(screen.getByTestId('ledger-total')).toHaveTextContent('-RD$60,938.22')
	})

	it('opens the row menu named after the item and forwards the actions', async () => {
		const user = userEvent.setup()
		const { props } = renderLedger()

		const trigger = screen.getByRole('button', { name: 'Actions for Rent' })
		expect(trigger.className).toContain('size-10')

		await user.click(trigger)
		await user.click(await screen.findByRole('menuitem', { name: 'Pause' }))
		expect(props.onToggle).toHaveBeenCalledWith(expect.objectContaining({ id: 'rent' }))

		await user.click(screen.getByRole('button', { name: 'Actions for Gym' }))
		expect(await screen.findByRole('menuitem', { name: 'Resume' })).toBeInTheDocument()
		await user.click(screen.getByRole('menuitem', { name: 'Delete' }))
		expect(props.onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: 'gym' }))
	})
})
