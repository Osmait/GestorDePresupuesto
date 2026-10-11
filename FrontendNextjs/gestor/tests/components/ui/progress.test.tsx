import { render, screen } from '@testing-library/react'
import { getProgressTone, Progress } from '@/components/ui/progress'

describe('Progress', () => {
	it('exposes progressbar semantics with the current value', () => {
		render(<Progress value={40} aria-label='Budget used' />)

		const bar = screen.getByRole('progressbar', { name: 'Budget used' })
		expect(bar).toHaveAttribute('aria-valuenow', '40')
		expect(bar).toHaveAttribute('aria-valuemax', '100')
	})

	it('clamps overflow to max and applies the tone to the indicator', () => {
		render(<Progress value={130} tone='destructive' aria-label='Overspent' />)

		const bar = screen.getByRole('progressbar', { name: 'Overspent' })
		expect(bar).toHaveAttribute('aria-valuenow', '100')
		expect(bar.firstElementChild).toHaveClass('bg-destructive')
	})

	it('styles the track with className (height) and the bar with indicatorClassName', () => {
		render(<Progress value={10} className='h-3' indicatorClassName='rounded-full' aria-label='x' />)

		const bar = screen.getByRole('progressbar')
		expect(bar).toHaveClass('h-3')
		expect(bar.firstElementChild).toHaveClass('rounded-full', 'bg-primary')
	})
})

describe('getProgressTone', () => {
	it('is neutral, then warning from 80%, then destructive from 100%', () => {
		expect(getProgressTone(50)).toBe('default')
		expect(getProgressTone(80)).toBe('warning')
		expect(getProgressTone(100)).toBe('destructive')
		expect(getProgressTone(60, { warningAt: 50 })).toBe('warning')
	})
})
