import { render, screen } from '@testing-library/react'
import { CategorySummaryCard } from '@/components/categories/CategorySummaryCard'
import { vi } from 'vitest'

vi.mock('next-intl', () => ({
    useTranslations: () => (key: string) => {
        const translations: Record<string, string> = {
            'summary': 'Summary',
            'totalCategories': 'Total Categories',
            'activeCategories': 'Active Categories',
            'averagePerCategory': 'Avg Per Category'
        }
        return translations[key] || key
    },
}))

vi.mock('@/components/ui/animated-counter', () => ({
    AnimatedCounter: ({ value }: { value: number }) => <span>{value}</span>
}))

describe('CategorySummaryCard', () => {
    const mockCategories = [
        { id: 'c1', name: 'Food', icon: '🍔', color: '#FF0000', user_id: 'u1', created_at: '', updated_at: '' },
        { id: 'c2', name: 'Transport', icon: '🚗', color: '#00FF00', user_id: 'u1', created_at: '', updated_at: '' },
        { id: 'c3', name: 'Entertainment', icon: '🎬', color: '#0000FF', user_id: 'u1', created_at: '', updated_at: '' }
    ]

    const mockTransactions = [
        { id: 't1', category_id: 'c1', amount: 50 },
        { id: 't2', category_id: 'c1', amount: 30 },
        { id: 't3', category_id: 'c2', amount: 100 },
    ] as any[]

    it('calculates totals correctly', () => {
        render(<CategorySummaryCard categories={mockCategories} transactions={mockTransactions} />)

        expect(screen.getByText('Summary')).toBeInTheDocument()

        // Total Categories: 3
        expect(screen.getByText('Total Categories')).toBeInTheDocument()
        expect(screen.getByText('3')).toBeInTheDocument()

        // Active Categories: 2 (c1 and c2 have transactions)
        expect(screen.getByText('Active Categories')).toBeInTheDocument()
        // Average is also 2. Both Active Categories and Average are 2, so use getAllByText
        expect(screen.getAllByText('2')).toHaveLength(2)

        // Average: 3 transactions / 2 active categories = 1.5 -> rounded to 2
        expect(screen.getByText('Avg Per Category')).toBeInTheDocument()
    })
})
