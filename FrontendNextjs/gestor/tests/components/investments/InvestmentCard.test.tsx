import { render, screen } from '@testing-library/react'
import { InvestmentCard } from '@/components/investments/InvestmentCard'
import { vi } from 'vitest'
import userEvent from '@testing-library/user-event'
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
        updated_at: ''
    }

    it('renders investment details and positive profit correctly', () => {
        render(
            <InvestmentCard
                investment={mockInvestment}
                onEdit={vi.fn()}
                onDelete={vi.fn()}
            />
        )

        expect(screen.getByText('Apple Inc. (AAPL)')).toBeInTheDocument()

        // Value: 10 * 180 = 1800
        expect(screen.getByText((content) => content.includes('1,800'))).toBeInTheDocument()

        // Profit: (180 - 150) * 10 = 300
        expect(screen.getByText((content) => content.includes('+') && content.includes('300'))).toBeInTheDocument()
        expect(screen.getByText((content) => content.includes('+') && content.includes('300'))).toHaveClass('text-green-600')
    })

    it('renders negative profit correctly', () => {
        const lossInvestment = { ...mockInvestment, current_price: 120 }
        render(
            <InvestmentCard
                investment={lossInvestment}
                onEdit={vi.fn()}
                onDelete={vi.fn()}
            />
        )

        // Profit: (120 - 150) * 10 = -300
        expect(screen.getByText((content) => content.includes('300') && !content.includes('+'))).toHaveClass('text-red-600')
    })

    it('triggers actions', async () => {
        const user = userEvent.setup()
        const onEdit = vi.fn()
        const onDelete = vi.fn()

        render(
            <InvestmentCard
                investment={mockInvestment}
                onEdit={onEdit}
                onDelete={onDelete}
            />
        )

        const buttons = screen.getAllByRole('button') // edit and delete
        await user.click(buttons[0]) // edit
        expect(onEdit).toHaveBeenCalledWith(mockInvestment)

        await user.click(buttons[1]) // delete
        expect(onDelete).toHaveBeenCalledWith('inv1')
    })
})
