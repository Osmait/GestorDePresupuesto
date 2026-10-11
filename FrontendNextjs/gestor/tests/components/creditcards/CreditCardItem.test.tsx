import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CreditCardItem } from '@/components/creditcards/CreditCardItem'
import { renderWithIntl } from '@/tests/utils/intl'
import type { CreditCard } from '@/types/creditcard'

// No hover/desktop media match, so the plain (non-Atropos) front face renders.
beforeEach(() => {
	vi.stubGlobal(
		'matchMedia',
		vi.fn((query: string) => ({
			matches: false,
			media: query,
			onchange: null,
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			addListener: vi.fn(),
			removeListener: vi.fn(),
			dispatchEvent: vi.fn(),
		})),
	)
})
afterEach(() => {
	vi.unstubAllGlobals()
})

const card: CreditCard = {
	id: 'card-1',
	name: 'Visa Gold',
	bank: 'BHD',
	last_four_digits: '4242',
	cut_day: 5,
	due_day: 25,
	balances: [
		{
			id: 'bal-1',
			currency: 'DOP',
			current_balance: -2500,
			credit_limit: 10000,
			available_credit: 7500,
			utilization_percent: 25,
			created_at: '',
			updated_at: '',
		},
	],
	created_at: '',
	updated_at: '',
}

function renderItem(overrides: Partial<Parameters<typeof CreditCardItem>[0]> = {}) {
	const props = {
		card,
		onEdit: vi.fn(),
		onDelete: vi.fn(),
		onPay: vi.fn(),
		onViewPayments: vi.fn(),
		onReset: vi.fn(),
		...overrides,
	}
	const view = renderWithIntl(<CreditCardItem {...props} />)
	const root = view.getByTestId('credit-card-item-card-1')
	const face = (name: 'front' | 'back') => root.querySelector(`[data-face='${name}']`) as HTMLElement
	return { ...view, props, root, face }
}

describe('CreditCardItem', () => {
	it('sizes the flip container from its content instead of a fixed height', () => {
		const { root, face } = renderItem()
		expect(root.innerHTML).not.toMatch(/h-\[\d+px\]/)
		// Both faces share one grid cell, so the taller one sets the card height.
		expect(face('front').parentElement).toHaveClass('grid')
		expect(face('front')).toHaveClass('[grid-area:1/1]')
		expect(face('back')).toHaveClass('[grid-area:1/1]')
	})

	it('shows the front and keeps the back face inert until flipped', () => {
		const { face } = renderItem()
		expect(face('front')).not.toHaveAttribute('inert')
		expect(face('back')).toHaveAttribute('inert')
		expect(within(face('front')).getByText('Visa Gold')).toBeInTheDocument()
	})

	it('flips with the View details button and back with Back, moving focus across faces', async () => {
		const user = userEvent.setup()
		const { face } = renderItem()

		const viewDetails = screen.getByRole('button', { name: 'View details' })
		await user.click(viewDetails)

		expect(face('front')).toHaveAttribute('inert')
		expect(face('back')).not.toHaveAttribute('inert')
		expect(face('front').parentElement).toHaveAttribute('data-flipped', 'true')
		const back = screen.getByRole('button', { name: 'Back' })
		expect(back).toHaveFocus()

		await user.click(back)
		expect(face('front')).not.toHaveAttribute('inert')
		expect(face('back')).toHaveAttribute('inert')
		expect(viewDetails).toHaveFocus()
	})

	it('flips from the keyboard', async () => {
		const user = userEvent.setup()
		const { face } = renderItem()

		screen.getByRole('button', { name: 'View details' }).focus()
		await user.keyboard('{Enter}')
		expect(face('back')).not.toHaveAttribute('inert')
		expect(screen.getByRole('button', { name: 'Back' })).toHaveFocus()

		await user.keyboard(' ')
		expect(face('front')).not.toHaveAttribute('inert')
		expect(screen.getByRole('button', { name: 'View details' })).toHaveFocus()
	})

	it('wires the back-face actions', async () => {
		const user = userEvent.setup()
		const { props } = renderItem()

		await user.click(screen.getByRole('button', { name: 'View details' }))
		await user.click(screen.getByRole('button', { name: 'Pay Card' }))
		await user.click(screen.getByRole('button', { name: 'View Payments' }))

		expect(props.onPay).toHaveBeenCalledWith(card)
		expect(props.onViewPayments).toHaveBeenCalledWith(card)
	})
})
