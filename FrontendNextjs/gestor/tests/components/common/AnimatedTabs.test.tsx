import { render, screen } from '@testing-library/react'
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
})
