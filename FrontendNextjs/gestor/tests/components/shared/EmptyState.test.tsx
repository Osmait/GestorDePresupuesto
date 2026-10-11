import { render, screen } from '@testing-library/react'
import { PiggyBank } from 'lucide-react'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/button'

describe('EmptyState', () => {
	it('renders icon, h2 title, description and action', () => {
		const { container } = render(
			<EmptyState
				icon={PiggyBank}
				title='No budgets yet'
				description='Create one to track spending.'
				action={<Button>Create budget</Button>}
			/>,
		)

		expect(screen.getByRole('heading', { level: 2, name: 'No budgets yet' })).toBeInTheDocument()
		expect(screen.getByText('Create one to track spending.')).toBeInTheDocument()
		expect(screen.getByRole('button', { name: 'Create budget' })).toBeInTheDocument()
		expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
	})

	it('compact variant uses a paragraph title and no min height', () => {
		const { container } = render(<EmptyState compact title='No data for this period' />)

		expect(screen.queryByRole('heading')).not.toBeInTheDocument()
		expect(screen.getByText('No data for this period').tagName).toBe('P')
		expect(container.firstChild).not.toHaveClass('min-h-[320px]')
	})

	it('lets the caller pick the heading level', () => {
		render(<EmptyState title='Nothing here' titleAs='h3' />)
		expect(screen.getByRole('heading', { level: 3, name: 'Nothing here' })).toBeInTheDocument()
	})
})
