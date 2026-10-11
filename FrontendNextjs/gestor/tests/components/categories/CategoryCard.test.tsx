import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { CategoryCard } from '@/components/categories/CategoryCard'
import { renderWithIntl } from '@/tests/utils/intl'

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

describe('CategoryCard', () => {
	const mockCategory = {
		id: 'cat1',
		name: 'Food',
		icon: '🍔',
		color: '#FF5733',
		user_id: 'u1',
		created_at: '',
		updated_at: '',
	}

	const mockStats = {
		id: 'cat1',
		label: 'Food',
		value: 80,
		color: '#FF5733',
		transaction_count: 2,
		dop_total: 80,
		usd_total: 0,
	}

	it('renders category details and totals', () => {
		renderWithIntl(<CategoryCard category={mockCategory} stats={mockStats} onDelete={vi.fn()} onEdit={vi.fn()} />)

		expect(screen.getByText('🍔')).toBeInTheDocument()
		expect(screen.getByText('2 transactions')).toBeInTheDocument()
		expect(screen.getByText('Total (DOP)')).toBeInTheDocument()
		expect(screen.getAllByText('RD$80.00').length).toBeGreaterThan(0)
		expect(screen.getByText('US$0.00')).toBeInTheDocument()
	})

	it('is a real link to the category transactions (keyboard reachable)', () => {
		renderWithIntl(<CategoryCard category={mockCategory} stats={mockStats} onDelete={vi.fn()} onEdit={vi.fn()} />)
		expect(screen.getByRole('link', { name: 'Food' })).toHaveAttribute('href', '/app/transactions?category=cat1')
	})

	it('shows the activity badge', () => {
		renderWithIntl(<CategoryCard category={mockCategory} stats={mockStats} onDelete={vi.fn()} onEdit={vi.fn()} />)
		// 2 transactions = Moderate
		expect(screen.getByText('Moderate')).toBeInTheDocument()
	})

	it('keeps the 40px menu visible (not hover-only) and edits from it', async () => {
		const user = userEvent.setup()
		const onEdit = vi.fn()
		renderWithIntl(<CategoryCard category={mockCategory} stats={mockStats} onDelete={vi.fn()} onEdit={onEdit} />)

		const trigger = screen.getByRole('button', { name: 'Actions for Food' })
		expect(trigger).toHaveClass('size-10')
		expect(trigger.closest('.opacity-0')).toBeNull()
		await user.click(trigger)
		await user.click(await screen.findByRole('menuitem', { name: 'Edit category' }))
		expect(onEdit).toHaveBeenCalled()
	})

	it('deletes after confirming', async () => {
		const user = userEvent.setup()
		const onDelete = vi.fn().mockResolvedValue(undefined)
		renderWithIntl(<CategoryCard category={mockCategory} stats={mockStats} onDelete={onDelete} onEdit={vi.fn()} />)

		await user.click(screen.getByRole('button', { name: 'Actions for Food' }))
		await user.click(await screen.findByRole('menuitem', { name: 'Delete category' }))
		const dialog = await screen.findByRole('alertdialog', { name: 'Delete the category "Food"?' })
		await user.click(screen.getByRole('button', { name: 'Delete' }))

		expect(onDelete).toHaveBeenCalledTimes(1)
		await waitFor(() => expect(dialog).not.toBeInTheDocument())
	})
})
