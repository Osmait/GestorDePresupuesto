import { render, screen } from '@testing-library/react'
import { Wallet } from 'lucide-react'
import { StatCard } from '@/components/shared/StatCard'
import { StatGrid } from '@/components/shared/StatGrid'

describe('StatCard', () => {
	it('renders label, value, hint and a decorative icon without adding headings', () => {
		const { container } = render(<StatCard label='Total balance' value='RD$1,000.00' hint='3 accounts' icon={Wallet} />)

		expect(screen.getByText('Total balance')).toBeInTheDocument()
		expect(screen.getByText('RD$1,000.00')).toHaveClass('tabular-nums')
		expect(screen.getByText('3 accounts')).toBeInTheDocument()
		expect(screen.queryByRole('heading')).not.toBeInTheDocument()
		expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
	})

	it('colors the value through semantic tones', () => {
		render(<StatCard label='Expenses' value='RD$50.00' tone='negative' />)
		expect(screen.getByText('RD$50.00')).toHaveClass('text-destructive')
	})

	it('shows skeletons instead of the value while loading', () => {
		render(<StatCard label='Income' value='RD$5.00' loading />)
		expect(screen.queryByText('RD$5.00')).not.toBeInTheDocument()
	})
})

describe('StatGrid', () => {
	it('is one column on mobile and N columns from lg', () => {
		const { container } = render(<StatGrid columns={3} />)
		expect(container.firstChild).toHaveClass('grid-cols-1', 'sm:grid-cols-2', 'lg:grid-cols-3')
	})
})
