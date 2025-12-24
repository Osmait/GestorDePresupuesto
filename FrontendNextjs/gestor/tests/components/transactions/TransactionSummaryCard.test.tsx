import { render, screen } from '@testing-library/react'
import TransactionSummaryCard from '@/components/transactions/TransactionSummaryCard'
import { vi } from 'vitest'
import { TypeTransaction } from '@/types/transaction'

// Mock dependencies
vi.mock('next-intl', () => ({
    useTranslations: () => (key: string) => {
        const translations: Record<string, string> = {
            'summary': 'Summary',
            'totalIncome': 'Total Income',
            'totalExpenses': 'Total Expenses',
            'totalTransactions': 'Total Transactions'
        }
        return translations[key] || key
    },
}))

vi.mock('@/components/common/AnimatedFlashNumber', () => ({
    AnimatedFlashNumber: ({ value, prefix = '' }: { value: number, prefix?: string }) => (
        <span>{prefix}{value}</span>
    )
}))

describe('TransactionSummaryCard', () => {
    const mockTransactions = [
        {
            id: 't1',
            name: 'Salary',
            amount: 5000,
            type_transation: TypeTransaction.INCOME,
            // ... minimal props
            user_id: 'u1',
            account_id: 'a1',
            category_id: 'c1',
            created_at: '',
            description: ''
        },
        {
            id: 't2',
            name: 'Rent',
            amount: 1500,
            type_transation: TypeTransaction.BILL,
            user_id: 'u1',
            account_id: 'a1',
            category_id: 'c1',
            created_at: '',
            description: ''
        }
    ]

    it('calculates and displays totals correctly', () => {
        render(<TransactionSummaryCard transactions={mockTransactions} />)

        // Income
        expect(screen.getByText('Total Income')).toBeInTheDocument()
        expect(screen.getByText('$5000')).toBeInTheDocument()

        // Expenses (Bill)
        expect(screen.getByText('Total Expenses')).toBeInTheDocument()
        expect(screen.getByText('$1500')).toBeInTheDocument()

        // Count
        expect(screen.getByText('Total Transactions')).toBeInTheDocument()
        expect(screen.getByText('2')).toBeInTheDocument()
    })

    it('handles empty transactions list', () => {
        render(<TransactionSummaryCard transactions={[]} />)
        // Should verify counts are 0
        expect(screen.getAllByText('$0').length).toBeGreaterThan(0)
    })
})
