import { screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Amount } from '@/components/shared/Amount'
import { renderWithIntl } from '@/tests/utils/intl'

// Records whether the react-countup wrapper was ever loaded.
const loaded = vi.hoisted(() => ({ counter: false }))
vi.mock('@/components/ui/animated-counter', () => {
	loaded.counter = true
	return { AnimatedCounter: ({ value }: { value: number }) => <span data-testid='counter'>{value}</span> }
})

function stubReducedMotion(reduce: boolean) {
	vi.stubGlobal(
		'matchMedia',
		vi.fn((query: string) => ({
			matches: query.includes('prefers-reduced-motion: reduce') ? reduce : false,
			media: query,
			onchange: null,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			addListener: vi.fn(),
			removeListener: vi.fn(),
			dispatchEvent: vi.fn(),
		})),
	)
}

afterEach(() => {
	vi.unstubAllGlobals()
})

describe('Amount animation', () => {
	it('renders static amounts without loading the counter', () => {
		stubReducedMotion(false)
		renderWithIntl(<Amount value={1500} currency='DOP' />, { locale: 'en' })

		expect(screen.getByText('RD$1,500.00')).toBeInTheDocument()
		expect(loaded.counter).toBe(false)
	})

	it('keeps an animated amount static when the user prefers reduced motion', () => {
		stubReducedMotion(true)
		renderWithIntl(<Amount value={1500} currency='DOP' animate />, { locale: 'en' })

		expect(screen.getByText('RD$1,500.00')).toBeInTheDocument()
		expect(screen.queryByTestId('counter')).not.toBeInTheDocument()
	})

	it('lazy-loads the counter for an animated amount', async () => {
		stubReducedMotion(false)
		renderWithIntl(<Amount value={1500} currency='DOP' animate />, { locale: 'en' })

		expect(await screen.findByTestId('counter')).toHaveTextContent('1500')
		expect(loaded.counter).toBe(true)
	})
})
