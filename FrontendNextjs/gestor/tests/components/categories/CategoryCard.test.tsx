import { render, screen } from '@testing-library/react'
import { CategoryCard } from '@/components/categories/CategoryCard'
import { vi } from 'vitest'

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

    const mockStats = {
        id: 'cat1',
        label: 'Food',
        value: 80,
        color: '#FF5733',
        transaction_count: 2,
        dop_total: 80,
        usd_total: 0,
    }

    it('renders category details correctly', () => {
        render(
            <CategoryCard
                category={mockCategory}
                stats={mockStats}
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
                stats={mockStats}
                onDelete={vi.fn()}
                onEdit={vi.fn()}
            />
        )
        // 2 transactions = Moderate
        expect(screen.getByText('Moderate')).toBeInTheDocument()
    })
})
