import { screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CreditCardAtroposVisual } from '@/components/creditcards/CreditCardAtroposVisual'
import { renderWithIntl } from '@/tests/utils/intl'
import type { CreditCard } from '@/types/creditcard'

// Records whether the Atropos module was ever loaded.
const loaded = vi.hoisted(() => ({ tilt: false }))
vi.mock('@/components/creditcards/CreditCardTilt', () => {
	loaded.tilt = true
	return { default: ({ children }: { children: React.ReactNode }) => <div data-testid='tilt'>{children}</div> }
})

function stubPointer(fineDesktop: boolean) {
	vi.stubGlobal(
		'matchMedia',
		vi.fn((query: string) => ({
			matches: fineDesktop,
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

const card = {
	id: 'card-1',
	name: 'Visa Gold',
	bank: 'BHD',
	last_four_digits: '4242',
	cut_day: 5,
	due_day: 25,
	balances: [],
} as unknown as CreditCard

function renderVisual() {
	return renderWithIntl(<CreditCardAtroposVisual card={card} totalDebtByCurrency={[]} onFlip={vi.fn()} />)
}

describe('CreditCardAtroposVisual', () => {
	it('renders the plain face without loading Atropos on touch or small screens', () => {
		stubPointer(false)
		renderVisual()

		expect(screen.getByText('Visa Gold')).toBeInTheDocument()
		expect(screen.queryByTestId('tilt')).not.toBeInTheDocument()
		expect(loaded.tilt).toBe(false)
	})

	it('lazy-loads the tilt for a fine pointer on a desktop screen', async () => {
		stubPointer(true)
		renderVisual()

		expect(await screen.findByTestId('tilt')).toHaveTextContent('Visa Gold')
		expect(loaded.tilt).toBe(true)
	})
})
