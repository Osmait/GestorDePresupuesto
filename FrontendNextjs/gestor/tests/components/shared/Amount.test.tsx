import { screen } from '@testing-library/react'
import { Amount, resolveAmountTone } from '@/components/shared/Amount'
import { renderWithIntl } from '@/tests/utils/intl'

function amountEl(text: string) {
	return screen.getByText(text).closest('[data-tone]') as HTMLElement
}

describe('resolveAmountTone', () => {
	it('follows the sign for auto and keeps explicit tones', () => {
		expect(resolveAmountTone(10, 'auto')).toBe('positive')
		expect(resolveAmountTone(-10, 'auto')).toBe('negative')
		expect(resolveAmountTone(0, 'auto')).toBe('neutral')
		// Rounds to cents like the formatter, so -0.004 is not "negative".
		expect(resolveAmountTone(-0.004, 'auto')).toBe('neutral')
		expect(resolveAmountTone(-10, 'positive')).toBe('positive')
		expect(resolveAmountTone(10, 'neutral')).toBe('neutral')
	})
})

describe('Amount', () => {
	it('formats with the active locale and currency symbol, with tabular figures', () => {
		renderWithIntl(<Amount value={1500.5} currency='DOP' />, { locale: 'en' })

		const el = amountEl('RD$1,500.50')
		expect(el).toHaveClass('tabular-nums')
		expect(el).toHaveAttribute('data-tone', 'neutral')
		expect(el.className).not.toMatch(/text-(success|destructive)/)
	})

	it('colors income with the success token and expenses with the destructive token (auto)', () => {
		renderWithIntl(
			<>
				<Amount value={200} currency='USD' tone='auto' />
				<Amount value={-75} currency='USD' tone='auto' />
			</>,
		)

		expect(amountEl('US$200.00')).toHaveClass('text-success')
		expect(amountEl('-US$75.00')).toHaveClass('text-destructive')
	})

	it('prints the sign when signed, but never on zero', () => {
		renderWithIntl(
			<>
				<Amount value={12} currency='USD' signed />
				<Amount value={-12} currency='USD' signed />
				<Amount value={0} currency='USD' signed tone='auto' />
			</>,
		)

		expect(screen.getByText('+US$12.00')).toBeInTheDocument()
		expect(screen.getByText('-US$12.00')).toBeInTheDocument()
		expect(amountEl('US$0.00')).toHaveAttribute('data-tone', 'neutral')
	})

	it('prints a tiny negative as a plain zero (no "-RD$0.00", no arrow)', () => {
		const { container } = renderWithIntl(<Amount value={-0.004} currency='DOP' tone='auto' signed icon />, {
			locale: 'en',
		})

		expect(amountEl('RD$0.00')).toHaveAttribute('data-tone', 'neutral')
		expect(container.querySelector('svg')).toBeNull()
	})

	it('adds a decorative direction arrow when icon is set', () => {
		const { container } = renderWithIntl(<Amount value={-5} currency='USD' tone='auto' icon />)

		const svg = container.querySelector('svg')
		expect(svg).toHaveAttribute('aria-hidden', 'true')
		expect(svg?.getAttribute('class')).toContain('lucide-arrow-down-right')
	})

	it('falls back to DOP and Spanish grouping', () => {
		renderWithIntl(<Amount value={1234.5} />, { locale: 'es' })
		expect(screen.getByText('RD$1,234.50')).toBeInTheDocument()
	})
})
