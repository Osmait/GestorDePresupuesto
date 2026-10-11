import { screen } from '@testing-library/react'
import { InvestmentSummaryCards } from '@/components/investments/InvestmentSummaryCards'
import { renderWithIntl } from '@/tests/utils/intl'

describe('InvestmentSummaryCards', () => {
	const mockMetrics = {
		totalValue: 5000,
		totalCost: 4000,
		totalProfit: 1000,
		roi: 25.0,
	}

	it('renders metrics with semantic tones', () => {
		renderWithIntl(<InvestmentSummaryCards metrics={mockMetrics} />)

		expect(screen.getByText('Total Value')).toBeInTheDocument()
		expect(screen.getByText('US$5,000.00')).toBeInTheDocument()

		expect(screen.getByText('Total Cost')).toBeInTheDocument()
		expect(screen.getByText('US$4,000.00')).toBeInTheDocument()

		expect(screen.getByText('Total Profit/Loss')).toBeInTheDocument()
		expect(screen.getByText('+US$1,000.00')).toHaveClass('text-success')

		expect(screen.getByText('ROI')).toBeInTheDocument()
		expect(screen.getByText('+25.00%')).toHaveClass('text-success')
	})

	it('renders negative metrics in the destructive color', () => {
		const negativeMetrics = {
			totalValue: 3000,
			totalCost: 4000,
			totalProfit: -1000,
			roi: -25.0,
		}
		renderWithIntl(<InvestmentSummaryCards metrics={negativeMetrics} />)

		expect(screen.getByText('-US$1,000.00')).toHaveClass('text-destructive')
		expect(screen.getByText('-25.00%')).toHaveClass('text-destructive')
	})

	it('keeps a zero profit and ROI neutral', () => {
		renderWithIntl(<InvestmentSummaryCards metrics={{ totalValue: 0, totalCost: 0, totalProfit: 0, roi: 0 }} />)

		expect(screen.getByText('0.00%')).toHaveClass('text-foreground')
		const profit = screen.getAllByText('US$0.00').find((el) => el.getAttribute('data-tone') !== null)
		expect(profit).toHaveAttribute('data-tone', 'neutral')
	})

	it('shows skeletons instead of values while loading', () => {
		renderWithIntl(<InvestmentSummaryCards metrics={mockMetrics} loading />)

		expect(screen.getByText('Total Value')).toBeInTheDocument()
		expect(screen.queryByText('US$5,000.00')).not.toBeInTheDocument()
	})
})
