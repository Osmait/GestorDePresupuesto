import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { ColorSwatchPicker } from '@/components/shared/ColorSwatchPicker'
import { EmojiPicker } from '@/components/shared/EmojiPicker'
import { renderWithIntl } from '@/tests/utils/intl'

describe('EmojiPicker', () => {
	it('exposes named toggle buttons with aria-pressed inside a labelled group', async () => {
		const user = userEvent.setup()
		const onChange = vi.fn()
		renderWithIntl(<EmojiPicker value='🍔' onChange={onChange} />, { locale: 'es' })

		expect(screen.getByRole('group', { name: 'Icono' })).toBeInTheDocument()
		expect(screen.getByRole('button', { name: 'Comida' })).toHaveAttribute('aria-pressed', 'true')
		const coffee = screen.getByRole('button', { name: 'Café' })
		expect(coffee).toHaveAttribute('aria-pressed', 'false')
		expect(coffee).toHaveClass('h-10', 'w-10')

		await user.click(coffee)
		expect(onChange).toHaveBeenCalledWith('☕')
	})
})

describe('ColorSwatchPicker', () => {
	it('matches the selected color case-insensitively and names every swatch', async () => {
		const user = userEvent.setup()
		const onChange = vi.fn()
		renderWithIntl(<ColorSwatchPicker value='#ef4444' onChange={onChange} />)

		expect(screen.getByRole('group', { name: 'Color' })).toBeInTheDocument()
		expect(screen.getByRole('button', { name: 'Red' })).toHaveAttribute('aria-pressed', 'true')

		await user.click(screen.getByRole('button', { name: 'Blue' }))
		expect(onChange).toHaveBeenCalledWith('#3B82F6')
	})

	it('offers a labelled custom color input when allowCustom is set', () => {
		renderWithIntl(<ColorSwatchPicker value='#123456' onChange={vi.fn()} allowCustom />)

		const input = screen.getByLabelText('Custom color')
		expect(input).toHaveAttribute('type', 'color')
		expect(input).toHaveValue('#123456')
	})
})
