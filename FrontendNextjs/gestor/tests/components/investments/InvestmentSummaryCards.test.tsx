import { render, screen } from '@testing-library/react'
import { InvestmentSummaryCards } from '@/components/investments/InvestmentSummaryCards'
import { vi } from 'vitest'

describe('InvestmentSummaryCards', () => {
    const mockMetrics = {
        totalValue: 5000,
        totalCost: 4000,
        totalProfit: 1000,
        roi: 25.00
    }

    it('renders metrics correctly', () => {
        render(<InvestmentSummaryCards metrics={mockMetrics} />)

        expect(screen.getByText('Total Value')).toBeInTheDocument()
        expect(screen.getByText((content) => content.includes('5,000'))).toBeInTheDocument()

        expect(screen.getByText('Total Cost')).toBeInTheDocument()
        expect(screen.getByText((content) => content.includes('4,000'))).toBeInTheDocument()

        expect(screen.getByText('Total Profit/Loss')).toBeInTheDocument()
        expect(screen.getByText((content) => content.includes('+') && content.includes('1,000'))).toHaveClass('text-green-600')

        expect(screen.getByText('ROI')).toBeInTheDocument()
        expect(screen.getByText('25.00%')).toHaveClass('text-green-600')
    })

    it('renders negative metrics correctly', () => {
        const negativeMetrics = {
            totalValue: 3000,
            totalCost: 4000,
            totalProfit: -1000,
            roi: -25.00
        }
        render(<InvestmentSummaryCards metrics={negativeMetrics} />)

        expect(screen.getByText((content) => content.includes('1,000') && !content.includes('+'))).toHaveClass('text-red-600')
        expect(screen.getByText('-25.00%')).toHaveClass('text-red-600')
    })
})
