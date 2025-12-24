import { render, screen } from '@testing-library/react'
import { BudgetCard } from '@/components/budgets/BudgetCard'
import { vi } from 'vitest'
import userEvent from '@testing-library/user-event'

// Mock dependencies
vi.mock('next/navigation', () => ({
    useRouter: () => ({
        push: vi.fn(),
    }),
}))

vi.mock('next-intl', () => ({
    useTranslations: () => (key: string) => {
        const translations: Record<string, string> = {
            'budgetFor': 'Budget For',
            'budget': 'Budget',
            'spent': 'Spent',
            'remaining': 'Remaining',
            'progress': 'Progress',
            'transactions': 'Transactions',
            'registered': 'registered',
            'edit': 'Edit',
            'delete': 'Delete',
            'critical': 'Critical',
        }
        return translations[key] || key
    },
}))

describe('BudgetCard', () => {
    const mockBudget = {
        id: 'b1',
        amount: 1000,
        current_amount: -800, // Spent 800
        category_id: 'c1',
        user_id: 'u1',
        created_at: '',
        updated_at: ''
    }

    const mockCategory = {
        id: 'c1',
        name: 'Groceries',
        icon: '🛒',
        color: 'blue',
        user_id: 'u1',
        created_at: '',
        updated_at: ''
    }

    const mockTransactions = [] as any[]

    it('renders budget details correctly', () => {
        render(
            <BudgetCard
                budget={mockBudget}
                category={mockCategory}
                transactions={mockTransactions}
                onDelete={vi.fn()}
                onEdit={vi.fn()}
            />
        )

        expect(screen.getByText('Budget For Groceries')).toBeInTheDocument()
        // Format checks - assuming default formatter or flexible matcher
        // $1,000 budget
        expect(screen.getByText((content) => content.includes('1,000'))).toBeInTheDocument()
        // $800 spent
        expect(screen.getByText((content) => content.includes('800'))).toBeInTheDocument()
    })

    it('shows critical badge when progress is high', () => {
        const criticalBudget = { ...mockBudget, current_amount: -900 } // 90%
        render(
            <BudgetCard
                budget={criticalBudget}
                category={mockCategory}
                transactions={mockTransactions}
                onDelete={vi.fn()}
                onEdit={vi.fn()}
            />
        )
        expect(screen.getByText('Critical')).toBeInTheDocument()
    })

    it('triggers edit action', async () => {
        const user = userEvent.setup()
        const onEdit = vi.fn()

        render(
            <BudgetCard
                budget={mockBudget}
                category={mockCategory}
                transactions={mockTransactions}
                onDelete={vi.fn()}
                onEdit={onEdit}
            />
        )

        // Open menu
        const trigger = screen.getByRole('button', { name: '' }) // more icon
        await user.click(trigger)

        // Click edit
        const editOption = await screen.findByText('Edit')
        await user.click(editOption)

        expect(onEdit).toHaveBeenCalledWith(mockBudget)
    })
})
