import { render, screen } from '@testing-library/react'
import { BudgetSummaryCard } from '@/components/budgets/BudgetSummaryCard'
import { vi } from 'vitest'

vi.mock('next-intl', () => ({
    useTranslations: () => (key: string) => {
        const translations: Record<string, string> = {
            'summary': 'Summary',
            'totalBudget': 'Total Budget',
            'totalSpent': 'Total Spent',
            'totalRemaining': 'Total Remaining',
            'exceededBudgets': 'Exceeded Budgets'
        }
        return translations[key] || key
    },
}))

vi.mock('@/components/ui/animated-counter', () => ({
    AnimatedCounter: ({ value, prefix = '' }: { value: number, prefix?: string }) => (
        <span>{prefix}{value}</span>
    )
}))

describe('BudgetSummaryCard', () => {
    const mockBudgets = [
        {
            id: '1',
            amount: 1000,
            current_amount: -500, // spent 500
            category_id: 'c1',
            user_id: 'u1',
            created_at: '',
            updated_at: ''
        },
        {
            id: '2',
            amount: 2000,
            current_amount: -2100, // spent 2100 (over budget)
            category_id: 'c2',
            user_id: 'u1',
            created_at: '',
            updated_at: ''
        }
    ]

    it('calculates totals correctly', () => {
        render(<BudgetSummaryCard budgets={mockBudgets} transactions={[]} />)

        // Total Budget: 1000 + 2000 = 3000
        expect(screen.getByText('Total Budget')).toBeInTheDocument()
        expect(screen.getByText('$3000')).toBeInTheDocument()

        // Total Spent: 500 + 2100 = 2600
        expect(screen.getByText('Total Spent')).toBeInTheDocument()
        expect(screen.getByText('$2600')).toBeInTheDocument()

        // Total Remaining: 3000 - 2600 = 400
        expect(screen.getByText('Total Remaining')).toBeInTheDocument()
        expect(screen.getByText('$400')).toBeInTheDocument()

        // Exceeded: 1
        expect(screen.getByText('Exceeded Budgets')).toBeInTheDocument()
        expect(screen.getByText('1')).toBeInTheDocument()
    })
})
