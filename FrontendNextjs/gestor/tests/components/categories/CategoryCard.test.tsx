import { render, screen } from '@testing-library/react'
import { CategoryCard } from '@/components/categories/CategoryCard'
import { vi } from 'vitest'
import userEvent from '@testing-library/user-event'

vi.mock('next/navigation', () => ({
    useRouter: () => ({
        push: vi.fn(),
    }),
}))

vi.mock('next-intl', () => ({
    useTranslations: () => (key: string) => {
        const translations: Record<string, string> = {
            'transactionsCount': 'transactions',
            'active': 'Active',
            'moderate': 'Moderate',
            'inactive': 'Inactive',
            'edit': 'Edit',
            'delete': 'Delete',
            'openMenu': 'Open menu'
        }
        return translations[key] || key
    },
}))

vi.mock('@/hooks/queries/useExchangeRateQuery', () => ({
	useExchangeRateQuery: () => ({
		data: { usd_to_dop: 60 },
	}),
}))

describe('CategoryCard', () => {
    const mockCategory = {
        id: 'cat1',
        name: 'Food',
        icon: '🍔',
        color: '#FF5733',
        user_id: 'u1',
        created_at: '',
        updated_at: ''
    }

    const mockTransactions = [
        { id: 't1', category_id: 'cat1', amount: 50, name: 'Lunch', type_transation: 'bill' as const },
        { id: 't2', category_id: 'cat1', amount: 30, name: 'Dinner', type_transation: 'bill' as const },
        { id: 't3', category_id: 'other', amount: 100, name: 'Other', type_transation: 'bill' as const }
    ] as any[]

    it('renders category details correctly', () => {
        render(
            <CategoryCard
                category={mockCategory}
                transactions={mockTransactions}
                onDelete={vi.fn()}
                onEdit={vi.fn()}
            />
        )

        expect(screen.getByText('Food')).toBeInTheDocument()
        expect(screen.getByText('🍔')).toBeInTheDocument()
        expect(screen.getByText('2 transactions')).toBeInTheDocument()
        // Total: 50 + 30 = 80
        expect(screen.getByText('Total (DOP)')).toBeInTheDocument()
        expect(screen.getAllByText((content) => content.includes('80')).length).toBeGreaterThan(0)
    })

    it('shows correct activity badge', () => {
        render(
            <CategoryCard
                category={mockCategory}
                transactions={mockTransactions}
                onDelete={vi.fn()}
                onEdit={vi.fn()}
            />
        )
        // 2 transactions = Moderate
        expect(screen.getByText('Moderate')).toBeInTheDocument()
    })
})
