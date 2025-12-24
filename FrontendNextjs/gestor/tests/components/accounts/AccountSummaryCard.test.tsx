import { render, screen } from '@testing-library/react'
import { AccountSummaryCard } from '@/components/accounts/AccountSummaryCard'
import { vi } from 'vitest'

// Mock dependencies
vi.mock('next-intl', () => ({
    useTranslations: () => (key: string) => {
        const translations: Record<string, string> = {
            'summary': 'Summary',
            'currentBalance': 'Current Balance',
            'initial': 'Initial',
            'positiveAccounts': 'Positive Accounts',
            'totalDifference': 'Total Difference',
            'totalAccounts': 'Total Accounts'
        }
        return translations[key] || key
    },
}))

// Mock AnimatedCounter to return simple text
vi.mock('@/components/ui/animated-counter', () => ({
    AnimatedCounter: ({ value, prefix = '' }: { value: number, prefix?: string }) => (
        <span>{prefix}{value}</span>
    )
}))

describe('AccountSummaryCard', () => {
    const mockAccounts = [
        {
            id: '1',
            name: 'Bank A',
            current_balance: 1000,
            initial_balance: 800,
            bank: 'Test',
            user_id: 'u1',
            created_at: '',
            updated_at: ''
        },
        {
            id: '2',
            name: 'Bank B',
            current_balance: -200,
            initial_balance: 0,
            bank: 'Test',
            user_id: 'u1',
            created_at: '',
            updated_at: ''
        }
    ]

    it('calculates and displays totals correctly', () => {
        render(<AccountSummaryCard accounts={mockAccounts} />)

        // Current Balance: 1000 + (-200) = 800
        expect(screen.getByText('Current Balance')).toBeInTheDocument()
        expect(screen.getByText('$800')).toBeInTheDocument()

        // Positive accounts count: 1 (Bank A)
        expect(screen.getByText('Positive Accounts')).toBeInTheDocument()
        expect(screen.getByText('1')).toBeInTheDocument()

        // Total Accounts: 2
        expect(screen.getByText('Total Accounts')).toBeInTheDocument()
        expect(screen.getByText('2')).toBeInTheDocument()
    })

    it('handles empty accounts list', () => {
        render(<AccountSummaryCard accounts={[]} />)
        // Multiple fields will be $0 (Current Balance, Difference)
        const zeroValues = screen.getAllByText((content) => content.includes('$0'))
        expect(zeroValues.length).toBeGreaterThan(0)
    })
})
