import { render, screen } from '@testing-library/react'
import TransactionItem from './TransactionItem'
import { vi } from 'vitest'
import { TypeTransaction } from '@/types/transaction'

// Mock dependencies
vi.mock('lucide-react', async () => {
    const actual = await vi.importActual('lucide-react')
    return {
        ...actual,
        // Add any specific mocks if necessary
    }
})

describe('TransactionItem', () => {
    const mockTransaction = {
        id: 't1',
        name: 'Netflix Subscription',
        description: 'Monthly payment',
        amount: 15.99,
        type_transation: TypeTransaction.EXPENSE,
        created_at: new Date('2024-01-01T12:00:00Z').toISOString(),
        account_id: 'a1',
        category_id: 'c1',
        user_id: 'u1'
    }

    const mockCategory = {
        id: 'c1',
        name: 'Entertainment',
        icon: '🎬',
        color: '#FF0000',
        user_id: 'u1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    }

    it('renders transaction details correctly', () => {
        render(<TransactionItem transaction={mockTransaction} category={mockCategory} />)

        expect(screen.getByText('Netflix Subscription')).toBeInTheDocument()
        expect(screen.getByText('Monthly payment')).toBeInTheDocument()
        expect(screen.getByText('Entertainment')).toBeInTheDocument()
        expect(screen.getByText((content) => content.includes('15.99'))).toBeInTheDocument()
    })

    it('renders expense with red styling', () => {
        render(<TransactionItem transaction={mockTransaction} />)

        // Find Element by text might fail if split, so we find the amount number first
        // Or check the amount text present in the card
        const amountText = screen.getByText((content, element) => {
            return element?.tagName.toLowerCase() === 'p' && content.includes('15.99')
        })
        expect(amountText).toBeInTheDocument()
        expect(amountText).toHaveClass('text-red-600')
        expect(amountText).toHaveTextContent('-')
    })

    it('renders income with green styling', () => {
        const incomeTransaction = {
            ...mockTransaction,
            name: 'Salary',
            amount: 5000,
            type_transation: TypeTransaction.INCOME
        }

        render(<TransactionItem transaction={incomeTransaction} />)

        const amountText = screen.getByText((content, element) => {
            return element?.tagName.toLowerCase() === 'p' && content.includes('5,000')
        })
        expect(amountText).toBeInTheDocument()
        expect(amountText).toHaveClass('text-green-600')
        expect(amountText).toHaveTextContent('+')
    })
})
