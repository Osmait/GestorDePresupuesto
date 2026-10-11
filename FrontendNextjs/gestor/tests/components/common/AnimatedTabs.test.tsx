import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { AnimatedTabs } from '@/components/common/animated-tabs'

beforeAll(() => {
	global.ResizeObserver = class ResizeObserver {
		observe() {}
		unobserve() {}
		disconnect() {}
	} as unknown as typeof globalThis.ResizeObserver
	window.matchMedia ??= vi.fn().mockReturnValue({
		matches: false,
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
	}) as unknown as typeof window.matchMedia
})

describe('AnimatedTabs', () => {
	it('gives icon tabs an accessible name (the label is visually hidden on mobile)', () => {
		render(
			<AnimatedTabs
				defaultValue='overview'
				urlParam={false}
				tabs={[
					{ value: 'overview', label: 'Resumen', icon: <svg data-testid='icon' />, content: <p>panel</p> },
					{ value: 'plain', label: 'Sin icono', content: <p>other</p> },
				]}
			/>,
		)

		const iconTab = screen.getByRole('tab', { name: 'Resumen' })
		expect(iconTab).toHaveAttribute('aria-label', 'Resumen')
		// The visible label stays in the DOM for sm+ screens; the icon is decorative.
		expect(iconTab).toHaveTextContent('Resumen')
		expect(screen.getByTestId('icon').parentElement).toHaveAttribute('aria-hidden', 'true')
		// Text-only tabs keep their visible text as the name.
		expect(screen.getByRole('tab', { name: 'Sin icono' })).not.toHaveAttribute('aria-label')
	})

	it('moves the selection with the arrow keys (roving tabindex) and skips missing panels in filter mode', async () => {
		const user = userEvent.setup()
		const onValueChange = vi.fn()
		render(
			<AnimatedTabs
				defaultValue='all'
				urlParam={false}
				noContent
				onValueChange={onValueChange}
				tabs={[
					{ value: 'all', label: 'Todos', content: null },
					{ value: 'income', label: 'Ingresos', content: null },
					{ value: 'expense', label: 'Gastos', content: null },
				]}
			/>,
		)

		const all = screen.getByRole('tab', { name: 'Todos' })
		expect(all).toHaveAttribute('tabindex', '0')
		expect(screen.getByRole('tab', { name: 'Ingresos' })).toHaveAttribute('tabindex', '-1')
		expect(all).not.toHaveAttribute('aria-controls')

		all.focus()
		await user.keyboard('{ArrowRight}')
		expect(onValueChange).toHaveBeenLastCalledWith('income')
		expect(screen.getByRole('tab', { name: 'Ingresos' })).toHaveFocus()
		expect(screen.getByRole('tab', { name: 'Ingresos' })).toHaveAttribute('aria-selected', 'true')

		await user.keyboard('{End}')
		expect(onValueChange).toHaveBeenLastCalledWith('expense')
		await user.keyboard('{ArrowRight}')
		expect(onValueChange).toHaveBeenLastCalledWith('all')
	})
})
