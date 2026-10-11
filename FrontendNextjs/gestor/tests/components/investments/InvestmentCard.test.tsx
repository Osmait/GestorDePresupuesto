import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { InvestmentCard } from '@/components/investments/InvestmentCard'
import { renderWithIntl } from '@/tests/utils/intl'
import { InvestmentType } from '@/types/investment'

describe('InvestmentCard', () => {
	const mockInvestment = {
		id: 'inv1',
		name: 'Apple Inc.',
		symbol: 'AAPL',
		quantity: 10,
		purchase_price: 150,
		current_price: 180,
		type: InvestmentType.STOCK,
		user_id: 'u1',
		created_at: '',
		updated_at: '',
	}

	it('renders investment details and a positive profit in the success color', () => {
		renderWithIntl(<InvestmentCard investment={mockInvestment} onEdit={vi.fn()} onDelete={vi.fn()} />)

		expect(screen.getByText('Apple Inc. (AAPL)')).toBeInTheDocument()

		// Value: 10 * 180 = 1800, settled in USD by default
		expect(screen.getByText('US$1,800.00')).toBeInTheDocument()
		expect(screen.getByText('10 shares @ US$180.00')).toBeInTheDocument()

		// Profit: (180 - 150) * 10 = 300, signed and colored through <Amount>
		const profit = screen.getByText('+US$300.00')
		expect(profit).toHaveAttribute('data-tone', 'positive')
		expect(profit).toHaveClass('text-success')
		expect(screen.getByText(/\+20\.00%/)).toHaveClass('text-success')
	})

	it('renders a loss in the destructive color', () => {
		const lossInvestment = { ...mockInvestment, current_price: 120 }
		renderWithIntl(<InvestmentCard investment={lossInvestment} onEdit={vi.fn()} onDelete={vi.fn()} />)

		// Profit: (120 - 150) * 10 = -300
		expect(screen.getByText('-US$300.00')).toHaveClass('text-destructive')
		expect(screen.getByText(/-20\.00%/)).toHaveClass('text-destructive')
	})

	it('keeps a zero gain neutral (not green)', () => {
		const flat = { ...mockInvestment, current_price: 150 }
		renderWithIntl(<InvestmentCard investment={flat} onEdit={vi.fn()} onDelete={vi.fn()} />)

		const profit = screen.getByText('US$0.00')
		expect(profit).toHaveAttribute('data-tone', 'neutral')
		expect(profit).not.toHaveClass('text-success')
	})

	it('triggers edit and delete from the actions menu', async () => {
		const user = userEvent.setup()
		const onEdit = vi.fn()
		const onDelete = vi.fn()

		renderWithIntl(<InvestmentCard investment={mockInvestment} onEdit={onEdit} onDelete={onDelete} />)

		await user.click(screen.getByRole('button', { name: 'Actions for Apple Inc.' }))
		await user.click(await screen.findByRole('menuitem', { name: 'Edit' }))
		expect(onEdit).toHaveBeenCalledWith(mockInvestment)

		await user.click(screen.getByRole('button', { name: 'Actions for Apple Inc.' }))
		await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
		expect(onDelete).toHaveBeenCalledWith('inv1')
	})

	it('renders in Spanish with the es locale', () => {
		renderWithIntl(<InvestmentCard investment={mockInvestment} onEdit={vi.fn()} onDelete={vi.fn()} />, {
			locale: 'es',
		})

		expect(screen.getByText('10 unidades a US$180.00')).toBeInTheDocument()
		expect(screen.getByRole('button', { name: 'Acciones de Apple Inc.' })).toBeInTheDocument()
	})
})
